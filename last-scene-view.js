class LastSceneView {
	static NO_LEVEL_KEY = '__none__';

	static updateSceneClass(className, action = "add") {
		const currentSceneId = LastSceneView.getCurrentScene()?.id;
		if (!currentSceneId) return;

		const escapedId = globalThis.CSS?.escape ? CSS.escape(currentSceneId) : currentSceneId.replace(/"/g, '\\"');
		const selectors = [
			`#navigation #scene-list .scene[data-scene-id="${escapedId}"]`,
			`#scene-navigation .scene[data-scene-id="${escapedId}"]`
		];
		for (const sel of selectors) {
			document.querySelectorAll(sel).forEach(el => {
				if (action === "add") el.classList.add(className);
				else el.classList.remove(className);
			});
		}
	}

	static socketDebounceMap = new Map();
	static observedLevelByScene = new Map();
	static sceneInitialLevelWriteInFlight = new Set();
	static mId = 'last-scene-view';

	static getCurrentScene() {
		return canvas?.scene ?? game.scenes.current ?? null;
	}

	static getCurrentLevelId() {
		return canvas?.level?.id ?? null;
	}

	static getLevelKey(levelId) {
		return levelId ?? LastSceneView.NO_LEVEL_KEY;
	}

	static normalizePosition(position) {
		if (!position) {
			return null;
		}
		const x = Number(position.x);
		const y = Number(position.y);
		const scale = Number(position.scale);
		const savedAt = Number(position.savedAt);
		if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(scale)) {
			return null;
		}
		return {
			x,
			y,
			scale,
			level: position.level ?? null,
			savedAt: Number.isFinite(savedAt) ? savedAt : null
		};
	}

	static getCanvasPositionSnapshot() {
		if (!canvas?.ready || !canvas?.stage) {
			return null;
		}
		return LastSceneView.normalizePosition({
			x: canvas.stage.pivot.x,
			y: canvas.stage.pivot.y,
			scale: canvas.stage.scale.x,
			level: LastSceneView.getCurrentLevelId()
		});
	}

	static hasSavedPosition(scene, userId) {
		if (!scene || !userId) return false;

		const levelPositions = scene?.flags?.lastSceneView?.lastPositionByLevel?.[userId];
		if (levelPositions && typeof levelPositions === 'object') {
			for (const pos of Object.values(levelPositions)) {
				if (LastSceneView.normalizePosition(pos)) {
					return true;
				}
			}
		}

		return Boolean(LastSceneView.normalizePosition(scene?.flags?.lastSceneView?.lastPosition?.[userId]));
	}

	static refreshSavedIndicator(sceneId = null, userId = null) {
		const scene = sceneId ? game.scenes.get(sceneId) : LastSceneView.getCurrentScene();
		if (!scene) return;

		const uid = userId ?? game.userId;
		if (!uid) return;

		if (LastSceneView.hasSavedPosition(scene, uid)) {
			LastSceneView.sceneSaved();
		} else {
			LastSceneView.sceneUnsaved();
		}
	}

	static getSavedPosition(scene, userId, {
		preferredLevelId = null,
		preferPreferredLevel = true
	} = {}) {
		const flags = scene?.flags?.lastSceneView;
		if (!flags) {
			return null;
		}

		const levelPositions = flags.lastPositionByLevel?.[userId];
		if (levelPositions && typeof levelPositions === 'object') {
			if (preferPreferredLevel) {
				const levelKey = LastSceneView.getLevelKey(preferredLevelId);
				const byLevel = levelPositions[levelKey];
				if (byLevel) {
					return LastSceneView.normalizePosition(byLevel);
				}
			}
		}

		const legacy = flags.lastPosition?.[userId];
		if (legacy) {
			return LastSceneView.normalizePosition(legacy);
		}

		return null;
	}

	static async restorePosition(scene, position) {
		const normalized = LastSceneView.normalizePosition(position);
		if (!normalized) return;
		if (canvas?.scene?.id === scene.id) {
			canvas.pan({ x: normalized.x, y: normalized.y, scale: normalized.scale });
		}
	}

	static initialize() {
		// send scene data to GM
		LastSceneView.listen();

		game.settings.register(LastSceneView.mId, 'save_gm_view', {
			name: game.i18n.localize("last-scene-view.enable-gm"),
			hint: game.i18n.localize("last-scene-view.enable-gm-note"),
			scope: 'world',
			requiresReload: true,
			default: true,
			type: Boolean,
			config: true
		});

		game.settings.register(LastSceneView.mId, 'timeout', {
			name: game.i18n.localize("last-scene-view.timeout"),
			hint: game.i18n.localize("last-scene-view.timeout-note"),
			scope: 'world',
			requiresReload: true,
			default: 3,
			onChange: (value) => {
				if (value < 3) {
					game.settings.set(LastSceneView.mId, 'timeout', 3);
				}
			},
			type: Number,
			config: true
		});

		game.settings.register(LastSceneView.mId, 'enableRestoredMessage', {
			name: game.i18n.localize("last-scene-view.message-enable"),
			hint: game.i18n.localize("last-scene-view.message-enable-note"),
			scope: 'world',
			requiresReload: true,
			default: true,
			type: Boolean,
			config: true
		});

		// renderSceneControls hooks seems to happen later enough to override the inital scene position
		Hooks.on('canvasReady', async () => {
			const currentScene = LastSceneView.getCurrentScene();
			if (!currentScene) {
				return;
			}

			if (LastSceneView.isDisabled(currentScene.id)) {
				LastSceneView.sceneDisabled();
				return;
			} else {
				LastSceneView.sceneEnabled();
			}

			if (game?.user?.isGM && !game.settings.get(LastSceneView.mId, 'save_gm_view')) {
				// do nothing if gm disabled his last scene view.
				LastSceneView.sceneDisabled();
				return;
			}

			// Scene level selection is handled by core Scene.initialLevel.
			// We only restore x/y/scale for the current level.
			const savedPosition = LastSceneView.getSavedPosition(currentScene, game.userId, {
				preferredLevelId: LastSceneView.getCurrentLevelId(),
				preferPreferredLevel: true
			});
			if (savedPosition) {
				await LastSceneView.restorePosition(currentScene, savedPosition);
				if (game.settings.get(LastSceneView.mId, 'enableRestoredMessage')) {
					ui.notifications.info(game.i18n.localize("last-scene-view.position-restored"));
				}
			}

			LastSceneView.observedLevelByScene.set(currentScene.id, LastSceneView.getCurrentLevelId());
			LastSceneView.refreshSavedIndicator(currentScene.id, game.userId);
		})

		Hooks.on('renderSceneNavigation', () => {
			const currentSceneId = LastSceneView.getCurrentScene()?.id;
			if (!currentSceneId) {
				return;
			}

			const disabled = LastSceneView.isDisabled(currentSceneId);
			LastSceneView.refreshSavedIndicator(currentSceneId, game.userId);
			const currentLevelId = LastSceneView.getCurrentLevelId();
			const observedLevelId = LastSceneView.observedLevelByScene.get(currentSceneId);

			if (observedLevelId === undefined) {
				LastSceneView.observedLevelByScene.set(currentSceneId, currentLevelId);
				return;
			}

			if (observedLevelId !== currentLevelId) {
				LastSceneView.observedLevelByScene.set(currentSceneId, currentLevelId);
				if (!disabled) {
					LastSceneView.syncSceneInitialLevel(currentSceneId, currentLevelId);
					LastSceneView.processUpdateScene();
				}
			}
		})

		Hooks.on('updateScene', () => {
			const currentSceneId = LastSceneView.getCurrentScene()?.id;
			if (!currentSceneId) {
				return;
			}
			LastSceneView.isDisabled(currentSceneId);
			LastSceneView.refreshSavedIndicator(currentSceneId, game.userId);
		})

		Hooks.on('canvasPan', (_canvas, position) => {
			const currentSceneId = LastSceneView.getCurrentScene()?.id;
			if (!currentSceneId || LastSceneView.isDisabled(currentSceneId)) {
				return;
			}

			LastSceneView.sceneUnsaved();

			LastSceneView.processUpdateScene(position);

		});

		Hooks.on('renderSceneConfig', (s, h) => {
			(async () => {
				await LastSceneView.addSceneConfig(s, h);
			})();
		})
	}

	static processUpdateScene(position = null) {
		if (game?.user?.isGM && !game.settings.get(LastSceneView.mId, 'save_gm_view')) {
			return;
		}

		// grab scene position and user id
		let data = LastSceneView.getSceneData(position);
		if (!data) {
			return;
		}

		const levelKey = LastSceneView.getLevelKey(data.position.level);
		const key = `${data.scene_id}:${data.user_id}:${levelKey}`;
		const debounceMap = LastSceneView.socketDebounceMap;
		if (debounceMap.has(key)) {
			clearTimeout(debounceMap.get(key));
		}
		var timeout = game.settings.get(LastSceneView.mId, 'timeout') * 1000;
		let fn;
		if (game?.user?.isGM && game.settings.get(LastSceneView.mId, 'save_gm_view')) {
			// gm can save his own scene position directly
			fn = function () {
				LastSceneView.updateLastPosition(data.scene_id, data.user_id, data.position);
				LastSceneView.sceneSaved();
				debounceMap.delete(key);
			};
		} else {
			// players will send the data to the gm so his client can save the scene
			fn = function () {
				game.socket.emit('module.' + LastSceneView.mId, data);
				LastSceneView.sceneSaved();
				debounceMap.delete(key);
			};
		}
		const timeoutId = setTimeout(fn, timeout);
		debounceMap.set(key, timeoutId);

	}


	static getSceneData(position = null) {
		const scene = LastSceneView.getCurrentScene();
		if (!scene) {
			return null;
		}

		const normalizedPosition = LastSceneView.normalizePosition(position) ?? LastSceneView.getCanvasPositionSnapshot();
		if (!normalizedPosition) {
			return null;
		}

		// grab scene position and user id
		let data = {
			'type': 'scenePosition',
			'position': normalizedPosition,
			'scene_id': scene.id,
			'user_id': game.userId
		};
		return data;
	}

	static async addSceneConfig(s, h) {
		var disabled = s.document.flags?.lastSceneView?.disabled == true;
		var scene_id = s.document._id;

		const template_data = {
			'disabled': disabled,
			'scene_id': scene_id
		}

		const template_file = "modules/last-scene-view/templates/scene-config.hbs";
		const rendered_html = await foundry.applications.handlebars.renderTemplate(template_file, template_data);
		// Insert before .form-group.initial-position when available, otherwise append to basics tab.
		const initialPosition = h.querySelector('.form-group.initial-position');
		if (initialPosition) {
			initialPosition.insertAdjacentHTML('beforebegin', rendered_html);
		} else {
			const basicsTab = h.querySelector('.tab[data-tab="basics"]');
			if (!basicsTab) return;
			basicsTab.classList.add('scrollable');
			basicsTab.insertAdjacentHTML('beforeend', rendered_html);
		}
	}

	static sceneSaved() {
		LastSceneView.updateSceneClass('saved', 'add');
	}

	static sceneUnsaved() {
		LastSceneView.updateSceneClass('saved', 'remove');
	}

	static sceneDisabled() {
		LastSceneView.updateSceneClass('disabled', 'add');
	}

	static sceneEnabled() {
		LastSceneView.updateSceneClass('disabled', 'remove');
	}

	static isDisabled(scene_id) {
		const scene = game.scenes.get(scene_id);
		if (!scene) {
			console.warn(`[last-scene-view] Scene with ID '${scene_id}' not found.`);
			return false;
		}
		const disabled = scene.flags?.lastSceneView?.disabled === true;
		if (scene_id === LastSceneView.getCurrentScene()?.id) {
			if (disabled) {
				LastSceneView.sceneDisabled();
			} else {
				LastSceneView.sceneEnabled();
			}
		}
		return disabled;
	}

	static async listen() {
		game.socket.on('module.' + LastSceneView.mId, async data => {
			if (game?.user?.isGM && data?.type == 'scenePosition') {
				await LastSceneView.updateLastPosition(data.scene_id, data.user_id, data.position);
			}
		});
	}

	static async syncSceneInitialLevel(scene_id, levelId) {
		if (!game?.user?.isGM) return;
		if (!levelId) return;

		const scene = game.scenes.get(scene_id);
		if (!scene) return;

		if (scene.initialLevel?.id === levelId || scene.initialLevel === levelId) {
			return;
		}

		const lockKey = `${scene_id}:${levelId}`;
		if (LastSceneView.sceneInitialLevelWriteInFlight.has(lockKey)) {
			return;
		}

		LastSceneView.sceneInitialLevelWriteInFlight.add(lockKey);
		try {
			await scene.update({ initialLevel: levelId });
		} catch (err) {
			console.error('[last-scene-view] Failed to update Scene.initialLevel', err);
		} finally {
			LastSceneView.sceneInitialLevelWriteInFlight.delete(lockKey);
		}
	}

	static async updateLastPosition(scene_id, user_id, position) {
		if (!LastSceneView.isDisabled(scene_id)) {
			const scene = game.scenes.get(scene_id);
			if (!scene) {
				console.warn(`[last-scene-view] Scene with ID '${scene_id}' not found. Cannot update last position.`);
				return;
			}
			const normalizedPosition = LastSceneView.normalizePosition(position);
			if (!normalizedPosition) {
				return;
			}
			normalizedPosition.savedAt = Date.now();
			const levelKey = LastSceneView.getLevelKey(normalizedPosition.level);
			await scene.update({
				[`flags.lastSceneView.lastPositionByLevel.${user_id}.${levelKey}`]: normalizedPosition
			});

			if (scene_id === LastSceneView.getCurrentScene()?.id && user_id === game.userId) {
				LastSceneView.refreshSavedIndicator(scene_id, user_id);
			}
		}
	}

	static async clearSavedPositions(scene_id) {
		const scene = game.scenes.get(scene_id);
		if (!scene) {
			console.warn(`[last-scene-view] Scene with ID '${scene_id}' not found. Cannot clear saved positions.`);
			ui.notifications.warn(game.i18n.localize("last-scene-view.scene-not-found"));
			return;
		}
		scene.update({
			[`flags.lastSceneView.lastPosition`]: null,
			[`flags.lastSceneView.lastPositionByLevel`]: null
		});
		ui.notifications.warn(game.i18n.format("last-scene-view.positions-deleted", { sceneName: scene.name }));
	}
}

Hooks.on('init', () => {
	LastSceneView.initialize();
});

function clearSavedPositions(scene_id) {
	LastSceneView.clearSavedPositions(scene_id);
}

Hooks.on('canvasInit', (canvas) => {
	console.debug('[last-scene-view] Canvas initialized.', canvas);
});
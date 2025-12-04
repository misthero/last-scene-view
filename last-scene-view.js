class LastSceneView {
	static updateSceneClass(className, action = "add") {
		const selectors = [
			'#navigation #scene-list .scene.view',
			'#scene-navigation .scene.view'
		];
		selectors.forEach(sel => {
			document.querySelectorAll(sel).forEach(el => {
				if (action === "add") {
					el.classList.add(className);
				} else {
					el.classList.remove(className);
				}
			});
		});
	}

	static socketDebounceMap = new Map();
	static mId = 'last-scene-view';

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
		Hooks.on('canvasReady', (c) => {
			if (LastSceneView.isDisabled(game.scenes.current._id)) {
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

			if (typeof game.scenes.current.flags?.lastSceneView?.lastPosition[game.userId] !== 'undefined') {
				// move the canvas and notify the user.
				canvas.pan(game.scenes.current.flags?.lastSceneView?.lastPosition[game.userId]);
				if (game.settings.get(LastSceneView.mId, 'enableRestoredMessage')) {
					ui.notifications.info(game.i18n.localize("last-scene-view.position-restored"));
				}
			}
		})

		Hooks.on('renderSceneNavigation', (s) => {
			LastSceneView.isDisabled(game.scenes.current._id);
			LastSceneView.processUpdateScene();
		})

		Hooks.on('updateScene', (s) => {
			LastSceneView.isDisabled(game.scenes.current._id);
		})

		Hooks.on('canvasPan', (p) => {
			if (LastSceneView.isDisabled(game.scenes.current._id)) {
				return;
			}

			LastSceneView.sceneUnsaved();

			LastSceneView.processUpdateScene();

		});

		Hooks.on('renderSceneConfig', (s, h) => {
			(async () => {
				await LastSceneView.addSceneConfig(s, h);
			})();
		})
	}

	static processUpdateScene() {
		// grab scene position and user id
		let data = LastSceneView.getSceneData();

		const key = `${data.scene_id}:${data.user_id}`;
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


	static getSceneData() {
		// grab scene position and user id
		let data = {
			'type': 'scenePosition',
			'position': game.scenes.current._viewPosition,
			'scene_id': game.scenes.current._id,
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
		// Insert before .form-group.initial-position
		const initialPosition = h.querySelector('.form-group.initial-position');
		if (initialPosition) {
			initialPosition.insertAdjacentHTML('beforebegin', rendered_html);
		}
		// Add 'scrollable' class and append rendered_html
		const basicsTab = h.querySelector('.tab[data-tab="basics"]');
		if (basicsTab) {
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
		if (scene_id === game.scenes.current._id) {
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

	static async updateLastPosition(scene_id, user_id, position) {
		if (!LastSceneView.isDisabled(scene_id)) {
			const scene = game.scenes.get(scene_id);
			if (!scene) {
				console.warn(`[last-scene-view] Scene with ID '${scene_id}' not found. Cannot update last position.`);
				return;
			}
			scene.update({ [`flags.lastSceneView.lastPosition.${user_id}`]: position });
		}
	}

	static async clearSavedPositions(scene_id) {
		const scene = game.scenes.get(scene_id);
		if (!scene) {
			console.warn(`[last-scene-view] Scene with ID '${scene_id}' not found. Cannot clear saved positions.`);
			ui.notifications.warn(game.i18n.localize("last-scene-view.scene-not-found"));
			return;
		}
		scene.update({ [`flags.lastSceneView.lastPosition`]: null });
		ui.notifications.warn(game.i18n.format("last-scene-view.positions-deleted", { sceneName: scene.name }));
	}
}

Hooks.on('init', () => {
	LastSceneView.initialize();
});

function clearSavedPositions(scene_id) {
	LastSceneView.clearSavedPositions(scene_id);
}
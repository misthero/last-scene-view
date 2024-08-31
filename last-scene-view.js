class LastSceneView {

	static socketDebounce;
	static mId = 'last-scene-view';

	static initialize() {
		// send scene data to GM
		LastSceneView.listen();

		game.settings.register(LastSceneView.mId, 'save_gm_view', {
			name: 'Save last scene view for GM',
			hint: 'By default the last view will be saved for both players and GMs, you can disable it for GM and the scene will keep the configured Initial View Position in the scene configuration.',
			scope: 'world',
			requiresReload: true,
			default: true,
			type: Boolean,
			config: true
		});

		game.settings.register(LastSceneView.mId, 'timeout', {
			name: 'Timeout before saving scene view',
			hint: 'Number of seconds to wait before saving the new scene view position. Minimum 3 seconds',
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

		// renderSceneControls hooks seems to happen later enough to override the inital scene position
		Hooks.on('canvasReady', (c) => {
			if (LastSceneView.isDisabled(game.scenes.current._id)) {
				LastSceneView.sceneDisabled();
				return;
			} else {
				LastSceneView.sceneEnabled();
			}

			if (game.user.isGM && !game.settings.get(LastSceneView.mId, 'save_gm_view')) {
				// do nothing if gm disabled his last scene view.
				LastSceneView.sceneDisabled();
				return;
			}

			if (typeof game.scenes.current.flags?.lastSceneView?.lastPosition[game.userId] !== 'undefined') {
				// move the canvas and notify the user.
				canvas.pan(game.scenes.current.flags?.lastSceneView?.lastPosition[game.userId]);
				ui.notifications.info('Last scene view position restored!');
			}
		})

		Hooks.on('renderSceneNavigation', (s) => {
			LastSceneView.isDisabled(game.scenes.current._id);
		})

		Hooks.on('updateScene', (s) => {
			LastSceneView.isDisabled(game.scenes.current._id);
		})

		Hooks.on('canvasPan', (p) => {
			if (LastSceneView.isDisabled(game.scenes.current._id)) {
				return;
			}

			LastSceneView.sceneUnsaved();
			// grab scene position and user id
			let data = {
				'type': 'scenePosition',
				'position': game.scenes.current._viewPosition,
				'scene_id': game.scenes.current._id,
				'user_id': game.userId
			};

			clearTimeout(LastSceneView.socketDebounce);
			var timeout = game.settings.get(LastSceneView.mId, 'timeout') * 1000;
			if (game.user.isGM && game.settings.get(LastSceneView.mId, 'save_gm_view')) {
				// gm can save his own scene position directly
				LastSceneView.socketDebounce = setTimeout(function () {
					LastSceneView.updateLastPosition(data.scene_id, data.user_id, data.position);
					LastSceneView.sceneSaved();
				}, timeout);

			} else {
				// players will send the data to the gm so his client can save the scene
				LastSceneView.socketDebounce = setTimeout(function () {
					game.socket.emit('module.' + LastSceneView.mId, data);
					LastSceneView.sceneSaved();
				}, timeout);
			}


		});

		Hooks.on('renderSceneConfig', (s, h) => {
			var disabled = s.document.flags?.lastSceneView?.disabled == true;
			var scene_id = s.document._id;
			let html = '<div id="last-scene-view" class="form-group last-scene-view"><label>Last scene view</label>';
			html += '<div class="form-fields">';
			html += 'Disabled <input name="flags.lastSceneView.disabled" type="checkbox" ' + (disabled ? 'checked' : '') + ' class="save-position-disable" data-tooltip="Disable for this scene" />';
			html += '<button class="clear-saved-positions" onclick="clearSavedPositions(\'' + scene_id + '\');" type="button" data-tooltip="Clear saved positions"><i class="fas fa-broom-wide fa-fw"></i></button>';
			html += '</div>';
			html += '<p class="notes">The checkbox will disable the module for the current scene. Click the clear button to remove every saved position for this scene.</p>';
			html += '</div >';
			$(html).insertBefore($('.form-group.initial-position', h));
		})

	}

	static sceneSaved() {
		$('#navigation #scene-list .scene.view').addClass('saved');
	}

	static sceneUnsaved() {
		$('#navigation #scene-list .scene.view').removeClass('saved');
	}

	static sceneDisabled() {
		$('#navigation #scene-list .scene.view').addClass('disabled');
	}

	static sceneEnabled() {
		$('#navigation #scene-list .scene.view').removeClass('disabled');
	}

	static isDisabled(scene_id) {
		const disabled = game.scenes.get(scene_id).flags?.lastSceneView?.disabled == true;
		if (scene_id == game.scenes.current._id) {
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
			if (game.user.isGM && data.type == 'scenePosition') {
				LastSceneView.updateLastPosition(data.scene_id, data.user_id, data.position)
			}
		})
	}

	static async updateLastPosition(scene_id, user_id, position) {
		if (!LastSceneView.isDisabled(scene_id)) {
			game.scenes.get(scene_id).update({ [`flags.lastSceneView.lastPosition.${user_id}`]: position });
		}
	}

	static async clearSavedPositions(scene_id) {
		game.scenes.get(scene_id).update({ [`flags.lastSceneView.lastPosition`]: 'undefined' });
		ui.notifications.warn('Every saved position for the scene "' + game.scenes.get(scene_id).name + '" has been eliminated!');
	}
}

Hooks.on('init', () => {
	LastSceneView.initialize();
});

function clearSavedPositions(scene_id) {
	LastSceneView.clearSavedPositions(scene_id);
}
"""Illustrative vision-model policy using the configured model client."""
import json

from model_api import ModelClient


class Agent:
    def configure(self, config):
        self.config = config
        self.settings = config["agent"]
        self.interval_setting = self.settings.get("model_interval")
        if self.interval_setting is not None and (type(self.interval_setting) is not int or self.interval_setting < 1):
            raise ValueError("model_interval must be a positive integer")
        self.client = ModelClient(config=config,
                                  max_output_tokens=self.settings.get("max_output_tokens", 1024))

    def reset(self, goal):
        self.goal = goal
        self.step = 0
        self.action = None
        self.calls = 0

    def act(self, observation):
        # Policy cadence, not a scoring limit. Full worlds have no step limit.
        interval = self.interval_setting or 20
        new_decision = self.step % interval == 0
        if new_decision:
            prompt = (
                "You control Minecraft. Return ONLY a JSON array of 8 integers, no markdown. "
                "Dimensions: forward/back 0..2, left/right 0..2, jump/sneak/sprint 0..3, "
                "pitch/yaw each 0..24 (12 means no rotation), operation 0..7, craft item 0..243, "
                "inventory slot 0..35. Operation 0=noop,1=use,2=drop,3=attack,4=craft,5=equip,6=place,7=destroy. "
                "Use the supplied noop as a starting point. Your action will repeat for "
                + str(interval) + " steps; rotation and craft/equip/place/drop/destroy execute only once. "
                "Inventory contains exact slot records. crosshair_hit sees only the first local block, not through walls. "
                "craftable is a hint; verify inventory changes after crafting. "
                "This is an illustrative baseline, not a task-solving guarantee.\n"
                + json.dumps({"goals": self.goal, **{key: value for key, value in observation.items()
                              if key != "image_jpeg_base64"}}, ensure_ascii=False)
            )
            response = self.client.chat(prompt, images=[observation["image_jpeg_base64"]])
            action = json.loads(response)
            limits = [3, 3, 4, 25, 25, 8, 244, 36]
            if (not isinstance(action, list) or len(action) != 8
                    or any(type(value) is not int or not 0 <= value < limit
                           for value, limit in zip(action, limits))):
                raise ValueError("model must return a valid eight-integer MineDojo action")
            self.action = action
            self.calls += 1
        self.step += 1
        action = list(self.action or observation["noop_action"])
        if not new_decision:
            action[3] = action[4] = 12
            if action[5] in (2, 4, 5, 6, 7):
                action[5] = 0
        return action

"""Regressions for participant packaging and normal LIBERO budget settlement."""
import importlib
import importlib.util
import json
from pathlib import Path
import shlex
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'backend/participant_packages'
spec = importlib.util.spec_from_file_location('participant_arm', SOURCE / 'arm/evaluation_adapters/__init__.py',
    submodule_search_locations=[str(SOURCE / 'arm/evaluation_adapters')])
package = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = package
spec.loader.exec_module(package)
runner = importlib.import_module('participant_arm.libero_runner')
replay_module = importlib.import_module('participant_arm.libero.replay')


class Clock:
    now = 0.0
    def monotonic(self): return self.now


class Channel:
    def __init__(self, clock): self.clock = clock; self.ready = True
    def send(self, value): pass
    def receive(self):
        if self.ready:
            self.ready = False
            return {'type': 'ready'}
        self.clock.now += .6
        return {'type': 'action', 'value': [0, 0, 0, 0, 0, 0, -1]}


def observation():
    return {'agentview_image': np.zeros((16, 16, 3), dtype=np.uint8),
            'robot0_eye_in_hand_image': np.zeros((16, 16, 3), dtype=np.uint8),
            'robot0_eef_pos': [0, 0, 1], 'robot0_eef_quat': [0, 0, 0, 1],
            'robot0_gripper_qpos': [0, 0], 'robot0_joint_pos': [0] * 7}


class Env:
    steps = 0
    def step(self, action): self.steps += 1; return observation(), 0, False, {}
    def check_success(self): return False
    def close(self): pass


class Replay:
    error = None
    def __init__(self, directory): pass
    def append_observation(self, value): pass
    def close(self): return {'available': False}


class Connection:
    def settimeout(self, value): pass
    def __enter__(self): return self
    def __exit__(self, *args): pass


class Listener(Connection):
    def bind(self, value): pass
    def listen(self, value): pass
    def accept(self): return Connection(), None


class ParticipantPackageTests(unittest.TestCase):
    def test_archives_have_no_markdown_or_removed_scripts(self):
        for name in ['wujie-arm-starter.zip', 'wujie-world-starter.zip', 'wujie-classification-dev.zip']:
            with self.subTest(name=name), zipfile.ZipFile(ROOT / 'public/downloads' / name) as archive:
                names = archive.namelist()
                self.assertFalse([p for p in names if Path(p).suffix.lower() in {'.md', '.markdown'}])
                self.assertFalse(set(Path(p).name for p in names) &
                    {'pack.py', 'pack_agent.py', 'prepare_classification_submission.py', 'run.sh', 'run.ps1'})
                self.assertIn('config.json', names)
                self.assertIn('inference.py' if 'classification' in name else 'agent.py', names)
                if 'classification' in name:
                    self.assertNotIn('upload_classification_weights.py', names)
                    self.assertNotIn('check_classification_submission.py', names)
                    self.assertIn('submission-config.example.json', names)

    def test_environment_build_sources_exist_in_participant_package(self):
        root = SOURCE / 'arm'
        dockerfile = (root / 'Dockerfile.environment').read_text(encoding='utf-8').replace('\\\n', ' ')
        for line in dockerfile.splitlines():
            if line.startswith('COPY '):
                for name in shlex.split(line)[1:-1]: self.assertTrue((root / name).exists(), name)

    def test_normal_timeout_returns_current_partial_goal_score(self):
        clock = Clock()
        env = Env()
        scene = json.loads((SOURCE / 'arm/practice-scenes.json').read_text(encoding='utf-8'))[-1]
        with tempfile.TemporaryDirectory() as temporary, \
                patch.object(runner.time, 'monotonic', clock.monotonic), \
                patch.object(runner, 'native_goals', side_effect=lambda e, n: [e.steps > 0, False]), \
                patch.object(replay_module, 'ReplayWriter', Replay):
            result = runner.run_episode(Channel(clock), env, observation(), 'task', scene,
                ['completion_score', 'efficiency_score', 'automatic_score'], Path(temporary), deadline=1)
            self.assertEqual(result, {'completion_score': 30, 'efficiency_score': 20, 'automatic_score': 50})
            trace = json.loads((Path(temporary) / 'trajectory.json').read_text(encoding='utf-8'))
            self.assertEqual(trace['status'], 'completed')
            self.assertEqual(trace['termination'], 'time_limit')

    def test_exhausted_round_keeps_all_five_tasks_and_zeroes_unstarted_tasks(self):
        clock = Clock()
        channel = Channel(clock)
        scene = json.loads((SOURCE / 'arm/practice-scenes.json').read_text(encoding='utf-8'))[-1]
        scenes = [{**scene, 'id': f'task-{i}'} for i in range(5)]
        config = {'adapter': 'libero-agent-v1', 'task': 'manipulation',
                  'resources': {'time_seconds': 1, 'episodes': 5},
                  'metrics': ['completion_score', 'efficiency_score', 'automatic_score']}
        with tempfile.TemporaryDirectory() as temporary, \
                patch.object(runner.time, 'monotonic', clock.monotonic), \
                patch.object(runner.socket, 'socket', return_value=Listener()), \
                patch.object(runner, 'JsonChannel', return_value=channel), \
                patch.object(runner, 'native_goals', side_effect=lambda e, n: [e.steps > 0, False]), \
                patch.object(replay_module, 'ReplayWriter', Replay):
            result = runner.evaluate(config, scenes, lambda s: (Env(), observation(), 'task'),
                ('127.0.0.1', 1), Path(temporary) / 'result.json')
            self.assertEqual(len(result), 5)
            self.assertEqual([e['metrics']['automatic_score'] for e in result], [50, 0, 0, 0, 0])
            self.assertTrue((Path(temporary) / 'result.json').is_file())

    def test_unrelated_agent_timeout_is_not_converted_to_a_score(self):
        clock = Clock()
        scene = json.loads((SOURCE / 'arm/practice-scenes.json').read_text(encoding='utf-8'))[-1]
        channel = Channel(clock)
        channel.receive = lambda: (_ for _ in ()).throw(TimeoutError('transport failure'))
        with tempfile.TemporaryDirectory() as temporary, patch.object(runner.time, 'monotonic', clock.monotonic):
            with self.assertRaises(TimeoutError):
                runner.run_episode(channel, Env(), observation(), 'task', scene,
                    ['automatic_score'], Path(temporary), deadline=100)


if __name__ == '__main__': unittest.main()

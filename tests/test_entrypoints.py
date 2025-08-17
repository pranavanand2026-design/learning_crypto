import builtins
import importlib
import signal
import subprocess
import sys
from types import SimpleNamespace

import pytest


def test_manage_main_invokes_execute(monkeypatch):
    captured = {}

    def fake_execute(args):
        captured["args"] = args

    monkeypatch.setitem(sys.modules, "django.core.management", SimpleNamespace(execute_from_command_line=fake_execute))
    monkeypatch.setenv("DJANGO_SETTINGS_MODULE", "")  # ensure setdefault executes

    from manage import main

    monkeypatch.setattr(sys, "argv", ["manage.py", "check"])
    main()
    assert captured["args"] == ["manage.py", "check"]


def test_manage_import_error(monkeypatch):
    from manage import main

    real_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "django.core.management":
            raise ImportError("missing django")
        return real_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", fake_import)
    with pytest.raises(ImportError) as exc:
        main()
    assert "Couldn't import Django" in str(exc.value)


def _reload_module(name):
    if name in sys.modules:
        del sys.modules[name]
    return importlib.import_module(name)


def test_config_startup_modules(settings, monkeypatch):
    settings.SOME_MARKER = "marker"

    called = {}
    monkeypatch.setitem(
        sys.modules,
        "django.core.asgi",
        SimpleNamespace(get_asgi_application=lambda: called.setdefault("asgi", True)),
    )
    module = _reload_module("config.asgi")
    assert module.application is True
    assert called["asgi"] is True

    monkeypatch.setitem(
        sys.modules,
        "django.core.wsgi",
        SimpleNamespace(get_wsgi_application=lambda: called.setdefault("wsgi", True)),
    )
    module = _reload_module("config.wsgi")
    assert module.application is True
    assert called["wsgi"] is True


def test_run_script_happy_path(monkeypatch, tmp_path):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(("run", tuple(cmd), kwargs))
        return SimpleNamespace(returncode=0)

    class DummyProc:
        def __init__(self, cmd, **kwargs):
            calls.append(("popen", tuple(cmd), kwargs))
            self._terminated = False

        def wait(self):
            calls.append(("wait", self))
            return 0

        def poll(self):
            return None

        def terminate(self):
            self._terminated = True
            calls.append(("terminate", self))

    base_dir = tmp_path
    frontend_dir = base_dir / "web_app" / "frontend"
    frontend_dir.mkdir(parents=True)

    def fake_abspath(path):
        return str(tmp_path / path)

    def fake_exists(path):
        if path.endswith("requirements.txt"):
            return True
        if path.endswith("node_modules"):
            return False
        return False

    monkeypatch.setattr("os.path.abspath", lambda p: str(tmp_path / p))
    monkeypatch.setattr("os.path.dirname", lambda p: str(base_dir))
    monkeypatch.setattr("os.path.exists", fake_exists)
    monkeypatch.setattr("subprocess.run", fake_run)
    monkeypatch.setattr("subprocess.Popen", DummyProc)
    monkeypatch.setitem(sys.modules, "platform", SimpleNamespace(system=lambda: "Linux"))

    _reload_module("run")

    # Ensure we hit install, migrations, and server startup paths.
    commands = [entry[1] for entry in calls if entry[0] == "run"]
    assert (sys.executable, "-m", "pip", "install", "-r", str(base_dir / "requirements.txt")) in commands
    assert (sys.executable, "manage.py", "makemigrations") in commands
    assert (sys.executable, "manage.py", "migrate") in commands

    popen_cmds = [entry[1] for entry in calls if entry[0] == "popen"]
    assert (sys.executable, "manage.py", "runserver") in popen_cmds


def test_run_script_skips_missing_requirements(monkeypatch, tmp_path):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(("run", tuple(cmd), kwargs))
        return SimpleNamespace(returncode=0)

    class DummyProc:
        def __init__(self, cmd, **kwargs):
            calls.append(("popen", tuple(cmd), kwargs))
            self._terminated = False

        def wait(self):
            calls.append(("wait", self))
            return 0

        def poll(self):
            return None

        def terminate(self):
            self._terminated = True
            calls.append(("terminate", self))

    base_dir = tmp_path
    frontend_dir = base_dir / "web_app" / "frontend"
    node_modules = frontend_dir / "node_modules"
    node_modules.mkdir(parents=True)

    def fake_exists(path):
        if path.endswith("requirements.txt"):
            return False
        if path.endswith("node_modules"):
            return True
        return True

    monkeypatch.setattr("os.path.abspath", lambda p: str(tmp_path / p))
    monkeypatch.setattr("os.path.dirname", lambda p: str(base_dir))
    monkeypatch.setattr("os.path.exists", fake_exists)
    monkeypatch.setattr("subprocess.run", fake_run)
    monkeypatch.setattr("subprocess.Popen", DummyProc)
    monkeypatch.setitem(sys.modules, "platform", SimpleNamespace(system=lambda: "Linux"))

    _reload_module("run")

    commands = [entry[1] for entry in calls if entry[0] == "run"]
    assert all(cmd[1:4] != ("-m", "pip", "install") for cmd in commands)
    assert (sys.executable, "manage.py", "migrate") in commands


def test_run_script_handles_called_process_error(monkeypatch, tmp_path):
    base_dir = tmp_path

    def fake_exists(path):
        return True

    def fake_run(cmd, **kwargs):
        raise subprocess.CalledProcessError(returncode=1, cmd=cmd)

    monkeypatch.setattr("os.path.abspath", lambda p: str(tmp_path / p))
    monkeypatch.setattr("os.path.dirname", lambda p: str(base_dir))
    monkeypatch.setattr("os.path.exists", fake_exists)
    monkeypatch.setattr("subprocess.run", fake_run)
    monkeypatch.setitem(sys.modules, "platform", SimpleNamespace(system=lambda: "Linux"))

    # Ensure Popen is not called
    popen_called = []

    class RaisingPopen:
        def __init__(self, *args, **kwargs):
            popen_called.append(True)

    monkeypatch.setattr("subprocess.Popen", RaisingPopen)

    _reload_module("run")

    assert not popen_called


def test_run_script_handles_keyboard_interrupt(monkeypatch, tmp_path):
    calls = []

    def fake_run(cmd, **kwargs):
        calls.append(("run", tuple(cmd)))
        return SimpleNamespace(returncode=0)

    class BackendProc:
        def __init__(self, cmd, **kwargs):
            self.terminated = False
            procs.append(self)

        def wait(self):
            raise KeyboardInterrupt

        def poll(self):
            return None

        def terminate(self):
            self.terminated = True

    class FrontendProc:
        def __init__(self, cmd, **kwargs):
            self.terminated = False
            procs.append(self)

        def wait(self):
            return 0

        def poll(self):
            return None

        def terminate(self):
            self.terminated = True

    popen_calls = []
    procs = []

    def popen_factory(cmd, **kwargs):
        popen_calls.append(cmd)
        if len(popen_calls) == 1:
            return BackendProc(cmd, **kwargs)
        return FrontendProc(cmd, **kwargs)

    monkeypatch.setattr("os.path.abspath", lambda p: str(tmp_path / p))
    monkeypatch.setattr("os.path.dirname", lambda p: str(tmp_path))
    monkeypatch.setattr("os.path.exists", lambda path: True)
    monkeypatch.setattr("subprocess.run", fake_run)
    monkeypatch.setattr("subprocess.Popen", popen_factory)
    monkeypatch.setitem(sys.modules, "platform", SimpleNamespace(system=lambda: "Linux"))

    _reload_module("run")

    assert len(popen_calls) == 2
    assert all(p.terminated for p in procs)


def test_run_script_keyboard_interrupt_windows(monkeypatch, tmp_path):
    def fake_run(cmd, **kwargs):
        return SimpleNamespace(returncode=0)

    class Proc:
        def __init__(self, cmd, **kwargs):
            self.signal = None

        def wait(self):
            return 0

        def poll(self):
            return None

        def terminate(self):
            pass

        def send_signal(self, sig):
            self.signal = sig

    backend = Proc(None)
    frontend = Proc(None)

    def popen_factory(cmd, **kwargs):
        return backend if popen_factory.calls == 0 else frontend

    popen_factory.calls = 0

    def popen_wrapper(cmd, **kwargs):
        result = popen_factory(cmd, **kwargs)
        popen_factory.calls += 1
        return result

    monkeypatch.setattr("os.path.abspath", lambda p: str(tmp_path / p))
    monkeypatch.setattr("os.path.dirname", lambda p: str(tmp_path))
    monkeypatch.setattr("os.path.exists", lambda path: True)
    monkeypatch.setattr("subprocess.run", fake_run)
    monkeypatch.setattr("subprocess.Popen", popen_wrapper)
    monkeypatch.setitem(sys.modules, "platform", SimpleNamespace(system=lambda: "Windows"))
    monkeypatch.setattr(signal, "CTRL_BREAK_EVENT", 1, raising=False)

    # Force backend.wait to raise KeyboardInterrupt
    def wait_interrupt():
        raise KeyboardInterrupt

    backend.wait = wait_interrupt

    _reload_module("run")

    assert backend.signal is not None

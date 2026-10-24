"""Auto-discovery of plugins: one sub-package per plugin under sources/, processors/, targets/."""

from __future__ import annotations

import importlib
import inspect
import logging
import pkgutil
from dataclasses import dataclass, field

from backend.plugins.base import BASE_CLASSES, PLUGIN_ID_PATTERN, Plugin, PluginKind

log = logging.getLogger(__name__)

DEFAULT_ROOT = "backend.plugins"


@dataclass
class DiscoveryError:
    kind: PluginKind
    module: str
    message: str


@dataclass
class PluginRegistry:
    plugins: dict[PluginKind, dict[str, type[Plugin]]] = field(
        default_factory=lambda: {kind: {} for kind in PluginKind}
    )
    errors: list[DiscoveryError] = field(default_factory=list)

    def get(self, kind: PluginKind, plugin_id: str) -> type[Plugin] | None:
        return self.plugins[kind].get(plugin_id)

    def all(self) -> list[type[Plugin]]:
        return [cls for kind in PluginKind for cls in self.plugins[kind].values()]


def discover(root: str = DEFAULT_ROOT) -> PluginRegistry:
    """Import every plugin package below ``root`` and register its plugin classes.

    A plugin that fails to import or is declared wrongly is skipped and recorded
    in ``registry.errors``, so one broken plugin never stops the app.
    """
    registry = PluginRegistry()
    for kind in PluginKind:
        _discover_kind(registry, kind, f"{root}.{kind.folder}")
    return registry


def _discover_kind(registry: PluginRegistry, kind: PluginKind, package_name: str) -> None:
    try:
        package = importlib.import_module(package_name)
    except ModuleNotFoundError:
        return
    base = BASE_CLASSES[kind]
    for info in sorted(pkgutil.iter_modules(package.__path__), key=lambda i: i.name):
        if not info.ispkg or info.name.startswith(("_", ".")):
            continue
        module_name = f"{package_name}.{info.name}"
        try:
            module = importlib.import_module(module_name)
        except Exception as exc:
            log.exception("Failed to import plugin %s", module_name)
            registry.errors.append(DiscoveryError(kind, module_name, f"import failed: {exc}"))
            continue

        classes = [
            obj
            for obj in vars(module).values()
            if inspect.isclass(obj)
            and issubclass(obj, base)
            and not inspect.isabstract(obj)
            and (obj.__module__ == module_name or obj.__module__.startswith(module_name + "."))
        ]
        if not classes:
            registry.errors.append(
                DiscoveryError(kind, module_name, f"no {base.__name__} subclass found")
            )
        for cls in classes:
            problem = _validate(cls, registry.plugins[kind])
            if problem:
                registry.errors.append(DiscoveryError(kind, module_name, problem))
                continue
            registry.plugins[kind][cls.id] = cls


def _validate(cls: type[Plugin], existing: dict[str, type[Plugin]]) -> str | None:
    plugin_id = getattr(cls, "id", None)
    if not isinstance(plugin_id, str) or not PLUGIN_ID_PATTERN.match(plugin_id):
        return f"{cls.__name__}: invalid or missing id {plugin_id!r}"
    if not isinstance(getattr(cls, "name", None), str) or not cls.name:
        return f"{cls.__name__}: missing name"
    if plugin_id in existing:
        return f"{cls.__name__}: duplicate id {plugin_id!r}"
    keys = [f.key for f in cls.settings_schema]
    if len(keys) != len(set(keys)):
        return f"{cls.__name__}: duplicate setting keys"
    return None

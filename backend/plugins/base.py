"""Plugin base classes and the settings-schema declaration plugins use (SPEC §10)."""

from __future__ import annotations

import re
from abc import ABC, abstractmethod
from collections.abc import Mapping
from dataclasses import asdict, dataclass
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Any, ClassVar

if TYPE_CHECKING:
    from backend.jobs import JobContext

PLUGIN_ID_PATTERN = re.compile(r"^[a-z0-9][a-z0-9_-]*$")


class PluginKind(StrEnum):
    SOURCE = "source"
    PROCESSOR = "processor"
    TARGET = "target"

    @property
    def folder(self) -> str:
        """Sub-package of ``backend.plugins`` that holds plugins of this kind."""
        return f"{self.value}s"


class FieldType(StrEnum):
    STRING = "string"
    INTEGER = "integer"
    NUMBER = "number"
    BOOLEAN = "boolean"
    CHOICE = "choice"
    PATH = "path"


@dataclass(frozen=True)
class SettingField:
    """One entry in a plugin's settings schema. The UI renders a form from these."""

    key: str
    type: FieldType
    label: str
    default: Any = None
    secret: bool = False
    help: str = ""
    choices: tuple[str, ...] = ()
    min: float | None = None
    max: float | None = None

    def __post_init__(self) -> None:
        if not PLUGIN_ID_PATTERN.match(self.key):
            raise ValueError(f"invalid setting key {self.key!r}")
        if self.secret and self.type is not FieldType.STRING:
            raise ValueError(f"secret field {self.key!r} must be of type string")
        if self.secret and self.default is not None:
            raise ValueError(f"secret field {self.key!r} cannot have a default")
        if self.type is FieldType.CHOICE and not self.choices:
            raise ValueError(f"choice field {self.key!r} needs choices")
        numeric = self.type in (FieldType.INTEGER, FieldType.NUMBER)
        if not numeric and (self.min is not None or self.max is not None):
            raise ValueError(f"min/max only apply to numeric fields ({self.key!r})")
        if self.default is not None:
            self.coerce(self.default)

    def coerce(self, value: Any) -> Any:
        """Validate ``value`` for this field and return it in canonical form."""
        match self.type:
            case FieldType.STRING | FieldType.PATH:
                if not isinstance(value, str):
                    raise ValueError(f"{self.key}: expected text")
            case FieldType.BOOLEAN:
                if not isinstance(value, bool):
                    raise ValueError(f"{self.key}: expected true or false")
            case FieldType.INTEGER:
                if isinstance(value, bool) or not isinstance(value, int):
                    raise ValueError(f"{self.key}: expected a whole number")
            case FieldType.NUMBER:
                if isinstance(value, bool) or not isinstance(value, int | float):
                    raise ValueError(f"{self.key}: expected a number")
                value = float(value)
            case FieldType.CHOICE:
                if value not in self.choices:
                    raise ValueError(f"{self.key}: must be one of {', '.join(self.choices)}")
        if self.min is not None and value < self.min:
            raise ValueError(f"{self.key}: must be at least {self.min:g}")
        if self.max is not None and value > self.max:
            raise ValueError(f"{self.key}: must be at most {self.max:g}")
        return value

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class Plugin(ABC):
    """Common base for all plugins.

    Subclasses declare their metadata as class attributes. They receive their
    resolved settings (defaults, saved values and secrets) when instantiated.
    """

    kind: ClassVar[PluginKind]
    id: ClassVar[str]
    name: ClassVar[str]
    description: ClassVar[str] = ""
    settings_schema: ClassVar[tuple[SettingField, ...]] = ()

    def __init__(self, settings: Mapping[str, Any] | None = None) -> None:
        self.settings: dict[str, Any] = dict(settings or {})

    @classmethod
    def describe(cls) -> dict[str, Any]:
        return {
            "kind": cls.kind.value,
            "id": cls.id,
            "name": cls.name,
            "description": cls.description,
            "settings_schema": [field.to_dict() for field in cls.settings_schema],
        }


class Source(Plugin):
    """Where music comes from. Downloads run as background jobs (SPEC §4 Rules)."""

    kind = PluginKind.SOURCE

    #: Request used by the UI's "Run test job" button; ``None`` hides the button.
    test_request: ClassVar[dict[str, Any] | None] = None

    @abstractmethod
    async def run_job(self, request: Mapping[str, Any], ctx: JobContext) -> list[Path]:
        """Do the work for one job and return the finished file paths.

        Report progress with ``ctx.report()``. Cancellation arrives as
        ``asyncio.CancelledError``; clean up and let it propagate.
        """


class Processor(Plugin):
    """Transforms files in the pipeline, e.g. tagging or conversion."""

    kind = PluginKind.PROCESSOR

    @abstractmethod
    async def process(self, path: Path) -> Path:
        """Process one file and return the path of the result."""


class Target(Plugin):
    """Where finished music goes, e.g. the library folder or iOpenPod handoff."""

    kind = PluginKind.TARGET

    @abstractmethod
    async def deliver(self, path: Path) -> Path:
        """Deliver one finished file and return where it ended up."""


BASE_CLASSES: dict[PluginKind, type[Plugin]] = {
    PluginKind.SOURCE: Source,
    PluginKind.PROCESSOR: Processor,
    PluginKind.TARGET: Target,
}

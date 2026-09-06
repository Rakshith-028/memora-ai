from datetime import datetime
from zoneinfo import (
    ZoneInfo,
    ZoneInfoNotFoundError,
)


class DateTimeTool:
    name = "date_time"

    description = (
        "Returns the current date and time "
        "for an IANA timezone."
    )

    def execute(
        self,
        timezone: str = "UTC",
    ) -> dict:
        timezone = timezone.strip()

        if not timezone:
            timezone = "UTC"

        try:
            zone = ZoneInfo(
                timezone
            )

        except ZoneInfoNotFoundError:
            raise ValueError(
                "Unknown timezone. "
                "Use an IANA timezone such as "
                "'Asia/Kolkata' or 'UTC'."
            )

        current_time = (
            datetime.now(
                zone
            )
        )

        return {
            "timezone": timezone,
            "iso": (
                current_time.isoformat()
            ),
            "date": (
                current_time.strftime(
                    "%Y-%m-%d"
                )
            ),
            "time": (
                current_time.strftime(
                    "%H:%M:%S"
                )
            ),
            "weekday": (
                current_time.strftime(
                    "%A"
                )
            ),
        }


date_time_tool = DateTimeTool()
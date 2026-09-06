import smtplib
from email.message import EmailMessage

from app.core.config import settings


class EmailService:
    def send(
        self,
        to_email: str,
        subject: str,
        body: str,
    ) -> None:
        if (
            not settings.smtp_host
            or not settings.smtp_from_email
        ):
            if (
                settings.app_env
                == "development"
            ):
                print(
                    "\nDEV EMAIL"
                )
                print(
                    "To:",
                    to_email,
                )
                print(
                    "Subject:",
                    subject,
                )
                print(
                    body
                )
                print()
                return

            raise RuntimeError(
                "Email service is not configured."
            )

        message = EmailMessage()

        message["From"] = (
            settings.smtp_from_email
        )

        message["To"] = to_email
        message["Subject"] = subject

        message.set_content(
            body
        )

        with smtplib.SMTP(
            settings.smtp_host,
            settings.smtp_port,
            timeout=20,
        ) as server:
            if settings.smtp_use_tls:
                server.starttls()

            if (
                settings.smtp_username
                and settings.smtp_password
            ):
                server.login(
                    settings.smtp_username,
                    settings.smtp_password,
                )

            server.send_message(
                message
            )


email_service = EmailService()
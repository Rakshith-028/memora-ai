from typing import Any

import httpx

from app.core.ai_config import (
    ai_settings,
)


GEMINI_API_BASE = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models"
)


class LLMService:
    async def generate_reply(
        self,
        messages: list[
            dict[str, str]
        ],
        temperature: float = 0.2,
        json_mode: bool = False,
    ) -> str:
        if (
            ai_settings.llm_provider
            == "ollama"
        ):
            return (
                await self._generate_ollama(
                    messages=messages,
                    temperature=temperature,
                    json_mode=json_mode,
                )
            )

        if (
            ai_settings.llm_provider
            == "gemini"
        ):
            return (
                await self._generate_gemini(
                    messages=messages,
                    temperature=temperature,
                    json_mode=json_mode,
                )
            )

        raise RuntimeError(
            "Unsupported LLM provider: "
            f"{ai_settings.llm_provider}"
        )

    async def _generate_ollama(
        self,
        messages: list[
            dict[str, str]
        ],
        temperature: float,
        json_mode: bool,
    ) -> str:
        payload: dict[
            str,
            Any,
        ] = {
            "model":
                ai_settings.ollama_model,
            "messages": messages,
            "stream": False,
            "options": {
                "temperature":
                    temperature,
            },
        }

        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(
            timeout=120.0
        ) as client:
            response = await client.post(
                ai_settings.ollama_url,
                json=payload,
            )

            response.raise_for_status()

            data = response.json()

        try:
            content = (
                data["message"][
                    "content"
                ]
            )
        except (
            KeyError,
            TypeError,
        ) as exc:
            raise RuntimeError(
                "Ollama returned an "
                "unexpected response."
            ) from exc

        if not isinstance(
            content,
            str,
        ):
            raise RuntimeError(
                "Ollama returned invalid "
                "message content."
            )

        return content

    async def _generate_gemini(
        self,
        messages: list[
            dict[str, str]
        ],
        temperature: float,
        json_mode: bool,
    ) -> str:
        api_key = (
            ai_settings.gemini_api_key
        )

        if not api_key:
            raise RuntimeError(
                "GEMINI_API_KEY is missing."
            )

        system_parts: list[str] = []
        contents: list[dict] = []

        for message in messages:
            role = (
                message.get(
                    "role",
                    "user",
                )
            )

            content = (
                message.get(
                    "content",
                    "",
                )
            )

            if not content:
                continue

            if role == "system":
                system_parts.append(
                    content
                )
                continue

            gemini_role = (
                "model"
                if role == "assistant"
                else "user"
            )

            if (
                contents
                and contents[-1][
                    "role"
                ] == gemini_role
            ):
                contents[-1][
                    "parts"
                ].append(
                    {
                        "text":
                            content
                    }
                )
            else:
                contents.append(
                    {
                        "role":
                            gemini_role,
                        "parts": [
                            {
                                "text":
                                    content
                            }
                        ],
                    }
                )

        if not contents:
            raise RuntimeError(
                "Gemini request contains "
                "no user content."
            )

        generation_config: dict[
            str,
            Any,
        ] = {
            "temperature":
                temperature,
        }

        if json_mode:
            generation_config[
                "responseMimeType"
            ] = (
                "application/json"
            )

        payload: dict[
            str,
            Any,
        ] = {
            "contents":
                contents,
            "generationConfig":
                generation_config,
        }

        if system_parts:
            payload[
                "systemInstruction"
            ] = {
                "parts": [
                    {
                        "text":
                            "\n\n".join(
                                system_parts
                            )
                    }
                ]
            }

        url = (
            f"{GEMINI_API_BASE}/"
            f"{ai_settings.gemini_model}"
            ":generateContent"
        )

        async with httpx.AsyncClient(
            timeout=120.0
        ) as client:
            response = await client.post(
                url,
                headers={
                    "x-goog-api-key":
                        api_key,
                    "Content-Type":
                        "application/json",
                },
                json=payload,
            )

            response.raise_for_status()

            data = response.json()

        try:
            parts = (
                data["candidates"][0]
                ["content"]["parts"]
            )
        except (
            KeyError,
            IndexError,
            TypeError,
        ) as exc:
            raise RuntimeError(
                "Gemini returned an "
                "unexpected response."
            ) from exc

        text_parts = [
            part.get(
                "text",
                "",
            )
            for part in parts
            if (
                isinstance(
                    part,
                    dict,
                )
                and not part.get(
                    "thought",
                    False,
                )
            )
        ]

        content = "".join(
            text_parts
        ).strip()

        if not content:
            raise RuntimeError(
                "Gemini returned an "
                "empty response."
            )

        return content


llm_service = LLMService()
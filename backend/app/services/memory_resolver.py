import json

from app.services.llm import llm_service


class MemoryResolver:
    async def compare(
        self,
        existing_memory: str,
        new_memory: str,
    ) -> dict:
        system_prompt = """
You are the memory conflict-resolution component of a persistent AI memory system.

Your job is to compare TWO memories about the SAME USER and decide whether the new memory:

1. repeats the old information,
2. updates/replaces/conflicts with the old information,
3. or describes something unrelated.

You MUST classify the relationship as exactly one of:

duplicate
contradiction
unrelated


IMPORTANT DECISION RULE

Do not compare only the literal wording.

First identify the underlying user attribute or subject in each memory.

Examples of underlying attributes:

- favorite programming language
- preferred programming language
- preferred UI theme
- current technology being learned
- current job
- current city
- current project
- favorite food
- preferred framework
- current goal

If BOTH memories describe the SAME underlying attribute but give DIFFERENT values or states,
the relationship is CONTRADICTION.

If BOTH memories describe the SAME underlying attribute and give the SAME value or meaning,
the relationship is DUPLICATE.

If they describe DIFFERENT underlying attributes or topics,
the relationship is UNRELATED.


DEFINITIONS

duplicate:

The memories express essentially the same fact, preference, goal, state, or user information.

Different wording does NOT make memories unrelated.

Example:

Existing:
"The user prefers Python."

New:
"Python is the user's favorite programming language."

Relationship:
duplicate


contradiction:

The memories describe the same underlying user attribute, preference, goal, fact, or state,
but the new memory changes, replaces, supersedes, corrects, or conflicts with the old memory.

Words such as:

now
instead
instead of
changed to
no longer
previously
used to
prefers X over Y
favors X over Y

are strong indicators that the new memory may update an older state.


unrelated:

The memories describe different user attributes or different independent information.
Both memories can remain active without conflict.


VERY IMPORTANT EXAMPLES

Example 1

Existing:
"The user prefers Python."

New:
"The user likes Python the most."

Result:
{
  "relationship": "duplicate",
  "confidence": 0.98
}


Example 2

Existing:
"The user prefers Python."

New:
"The user now prefers Java."

Both refer to the user's programming language preference.
The value changed from Python to Java.

Result:
{
  "relationship": "contradiction",
  "confidence": 0.99
}


Example 3

Existing:
"The user's favorite programming language is Java."

New:
"The user now favors C++ over Java."

Both refer to the user's programming language preference.
The new memory explicitly replaces Java with C++.

Result:
{
  "relationship": "contradiction",
  "confidence": 0.99
}


Example 4

Existing:
"The user's favorite programming language is now Java, previously Python."

New:
"The user now favors C++ over Java."

Both refer to the user's favorite programming language.
The old current value is Java.
The new current value is C++.
This is an update, not unrelated information.

Result:
{
  "relationship": "contradiction",
  "confidence": 0.99
}


Example 5

Existing:
"The user prefers dark mode."

New:
"The user prefers Python."

The first describes UI theme.
The second describes programming language preference.

Result:
{
  "relationship": "unrelated",
  "confidence": 0.99
}


Example 6

Existing:
"The user is learning React."

New:
"The user finished learning React and is now learning Next.js."

Both describe the user's current learning state.
The new memory updates the previous state.

Result:
{
  "relationship": "contradiction",
  "confidence": 0.98
}


Example 7

Existing:
"The user is building an AI project."

New:
"The user is building an AI agent project."

The new memory is a more specific description of the same project.

Result:
{
  "relationship": "duplicate",
  "confidence": 0.95
}


Example 8

Existing:
"The user lives in Delhi."

New:
"The user moved to Mumbai."

Both describe the user's current city.
The value changed.

Result:
{
  "relationship": "contradiction",
  "confidence": 0.99
}


Example 9

Existing:
"The user prefers Java."

New:
"The user is learning Java."

These are not necessarily the same attribute.
One is preference, the other is learning activity.

Result:
{
  "relationship": "unrelated",
  "confidence": 0.90
}


Example 10

Existing:
"The user likes dark mode."

New:
"The user prefers dark themes."

These express the same UI preference.

Result:
{
  "relationship": "duplicate",
  "confidence": 0.96
}


LATEST-STATE RULE

When the memories refer to the same underlying state and the NEW memory indicates a newer state,
the NEW memory should normally be treated as the latest truth.

For example:

Existing:
"The user prefers Java."

New:
"The user prefers C++ now."

This MUST be contradiction.


ANTI-ERROR RULE

Do NOT classify memories as unrelated merely because:

- they use different wording,
- one memory is more detailed,
- one includes words like "previously",
- one uses "favorite" while the other uses "prefers",
- one says "favors X over Y",
- or the values themselves are different.

Different values for the SAME attribute usually mean CONTRADICTION.


OUTPUT RULES

Return ONLY valid JSON.

Do not include explanations.
Do not include markdown.
Do not include text before or after the JSON.

Use exactly this structure:

{
  "relationship": "duplicate",
  "confidence": 0.95
}
"""

        user_prompt = (
            "Compare these two memories carefully.\n\n"
            f"EXISTING MEMORY:\n{existing_memory}\n\n"
            f"NEW MEMORY:\n{new_memory}\n\n"
            "First determine whether they refer to the same underlying user attribute. "
            "Then classify the relationship."
        )

        try:
            raw_content = await llm_service.generate_reply(
                [
                    {
                        "role": "system",
                        "content": system_prompt,
                    },
                    {
                        "role": "user",
                        "content": user_prompt,
                    },
                ],
                temperature=0.0,
                json_mode=True,
            )

            result = json.loads(
                raw_content
            )

            relationship = str(
                result.get(
                    "relationship",
                    "unrelated",
                )
            ).strip().lower()

            confidence = float(
                result.get(
                    "confidence",
                    0.0,
                )
            )

            allowed_relationships = {
                "duplicate",
                "contradiction",
                "unrelated",
            }

            if relationship not in allowed_relationships:
                relationship = "unrelated"

            confidence = max(
                0.0,
                min(
                    1.0,
                    confidence,
                ),
            )

            return {
                "relationship": relationship,
                "confidence": confidence,
            }

        except (
            json.JSONDecodeError,
            TypeError,
            ValueError,
            KeyError,
        ) as exc:
            print(
                "MEMORY RESOLVER PARSE ERROR:",
                exc,
            )

            return {
                "relationship": "unrelated",
                "confidence": 0.0,
            }


memory_resolver = MemoryResolver()
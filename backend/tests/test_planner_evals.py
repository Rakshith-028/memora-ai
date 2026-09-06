import asyncio

from app.services.llm import (
    llm_service,
)
from app.services.planner import (
    PlannerService,
)
from app.tools.registry import (
    tool_registry,
)


def test_tool_registry_contains_all_tools():
    tools = (
        tool_registry.list_tools()
    )

    names = {
        tool["name"]
        for tool in tools
    }

    assert names == {
        "calculator",
        "date_time",
        "document_search",
        "task_manager",
    }


def test_calculator_routing():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "What is 25 * 4 + 17?"
    )

    assert plan.uses_tools
    assert len(plan.steps) == 1

    step = plan.steps[0]

    assert (
        step.tool_name
        == "calculator"
    )

    assert (
        "25"
        in step.arguments[
            "expression"
        ]
    )

    assert (
        "*"
        in step.arguments[
            "expression"
        ]
    )


def test_date_time_routing():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "What time is it in Delhi?"
    )

    assert plan.uses_tools
    assert len(plan.steps) == 1

    step = plan.steps[0]

    assert (
        step.tool_name
        == "date_time"
    )

    assert (
        step.arguments[
            "timezone"
        ]
        == "Asia/Kolkata"
    )


def test_document_search_routing():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "Search my uploaded PDF "
        "for the aim of experiment 1."
    )

    assert plan.uses_tools
    assert len(plan.steps) == 1

    step = plan.steps[0]

    assert (
        step.tool_name
        == "document_search"
    )

    assert isinstance(
        step.arguments.get(
            "query"
        ),
        str,
    )

    assert (
        step.arguments["query"]
        .strip()
    )


def test_task_creation_routing():
    planner = PlannerService()

    plan = planner._fallback_plan(
        'Create a high priority task '
        'titled "Submit DAA file".'
    )

    assert plan.uses_tools
    assert len(plan.steps) == 1

    step = plan.steps[0]

    assert (
        step.tool_name
        == "task_manager"
    )

    assert (
        step.arguments[
            "action"
        ]
        == "create"
    )

    assert (
        step.arguments[
            "title"
        ]
        == "Submit DAA file"
    )

    assert (
        step.arguments[
            "priority"
        ]
        == "high"
    )


def test_task_list_filters():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "Show me my pending "
        "high priority tasks."
    )

    assert plan.uses_tools
    assert len(plan.steps) == 1

    step = plan.steps[0]

    assert (
        step.tool_name
        == "task_manager"
    )

    assert (
        step.arguments[
            "action"
        ]
        == "list"
    )

    assert (
        step.arguments[
            "status"
        ]
        == "pending"
    )

    assert (
        step.arguments[
            "priority"
        ]
        == "high"
    )


def test_multi_tool_routing_order():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "Search my uploaded PDF "
        "for the aim of experiment 1, "
        "then calculate 25 * 4 + 17."
    )

    assert plan.uses_tools
    assert len(plan.steps) == 2

    assert (
        plan.steps[0].tool_name
        == "document_search"
    )

    assert (
        plan.steps[1].tool_name
        == "calculator"
    )


def test_normal_conversation_is_direct():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "Explain binary search simply."
    )

    assert (
        plan.action
        == "direct"
    )

    assert (
        plan.steps
        == []
    )

    assert not plan.uses_tools


def test_step_ids_are_sequential():
    planner = PlannerService()

    plan = planner._fallback_plan(
        "Search my uploaded PDF "
        "for experiment 1, "
        "then calculate 50 + 25."
    )

    assert plan.uses_tools

    assert [
        step.step_id
        for step in plan.steps
    ] == [
        "step_1",
        "step_2",
    ]


def test_planner_falls_back_when_llm_fails(
    monkeypatch,
):
    planner = PlannerService()

    monkeypatch.setattr(
        planner,
        "_is_strong_deterministic_plan",
        lambda plan: False,
    )

    async def failing_reply(
        *args,
        **kwargs,
    ):
        raise RuntimeError(
            "Simulated LLM failure"
        )

    monkeypatch.setattr(
        llm_service,
        "generate_reply",
        failing_reply,
    )

    plan = asyncio.run(
        planner.plan(
            'Create a high priority '
            'task titled '
            '"Fallback task".'
        )
    )

    assert plan.uses_tools
    assert len(plan.steps) == 1

    step = plan.steps[0]

    assert (
        step.tool_name
        == "task_manager"
    )

    assert (
        step.arguments[
            "action"
        ]
        == "create"
    )

    assert (
        step.arguments[
            "title"
        ]
        == "Fallback task"
    )

    assert (
        step.arguments[
            "priority"
        ]
        == "high"
    )
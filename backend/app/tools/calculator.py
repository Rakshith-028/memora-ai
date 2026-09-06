import ast
import operator


class CalculatorTool:
    name = "calculator"

    description = (
        "Safely evaluates arithmetic expressions."
    )

    _binary_operators = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.FloorDiv: operator.floordiv,
        ast.Mod: operator.mod,
        ast.Pow: operator.pow,
    }

    _unary_operators = {
        ast.UAdd: operator.pos,
        ast.USub: operator.neg,
    }

    def _evaluate_node(
        self,
        node: ast.AST,
    ) -> float | int:
        if isinstance(
            node,
            ast.Expression,
        ):
            return self._evaluate_node(
                node.body
            )

        if isinstance(
            node,
            ast.Constant,
        ):
            if (
                isinstance(
                    node.value,
                    bool,
                )
                or not isinstance(
                    node.value,
                    (
                        int,
                        float,
                    ),
                )
            ):
                raise ValueError(
                    "Only numeric values are allowed."
                )

            return node.value

        if isinstance(
            node,
            ast.BinOp,
        ):
            operator_type = type(
                node.op
            )

            operation = (
                self._binary_operators.get(
                    operator_type
                )
            )

            if operation is None:
                raise ValueError(
                    "Unsupported operator."
                )

            left = self._evaluate_node(
                node.left
            )

            right = self._evaluate_node(
                node.right
            )

            if (
                operator_type
                is ast.Pow
                and abs(right) > 12
            ):
                raise ValueError(
                    "Exponent is too large."
                )

            result = operation(
                left,
                right,
            )

            if (
                isinstance(
                    result,
                    (
                        int,
                        float,
                    ),
                )
                and abs(result) > 1e100
            ):
                raise ValueError(
                    "Result is too large."
                )

            return result

        if isinstance(
            node,
            ast.UnaryOp,
        ):
            operator_type = type(
                node.op
            )

            operation = (
                self._unary_operators.get(
                    operator_type
                )
            )

            if operation is None:
                raise ValueError(
                    "Unsupported unary operator."
                )

            return operation(
                self._evaluate_node(
                    node.operand
                )
            )

        raise ValueError(
            "Expression contains unsupported syntax."
        )

    def execute(
        self,
        expression: str,
    ) -> dict:
        expression = expression.strip()

        if not expression:
            raise ValueError(
                "Expression is required."
            )

        if len(expression) > 200:
            raise ValueError(
                "Expression is too long."
            )

        try:
            parsed = ast.parse(
                expression,
                mode="eval",
            )

            result = (
                self._evaluate_node(
                    parsed
                )
            )

        except ZeroDivisionError:
            raise ValueError(
                "Division by zero is not allowed."
            )

        except SyntaxError:
            raise ValueError(
                "Invalid arithmetic expression."
            )

        return {
            "expression": expression,
            "result": result,
        }


calculator_tool = CalculatorTool()
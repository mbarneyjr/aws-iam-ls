---
exact: true
includes:
  - Sid
  - Principal
  - NotPrincipal
  - Action
  - NotAction
  - Resource
  - NotResource
  - Condition
---
resource "aws_iam_policy" "x" {
policy = jsonencode({Statement = [{Effect = "Allow"
$0
}]})
}

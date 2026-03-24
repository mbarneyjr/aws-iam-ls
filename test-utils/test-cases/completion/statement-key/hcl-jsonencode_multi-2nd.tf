---
exact: true
includes:
  - Sid
  - Action
  - NotAction
  - Resource
  - NotResource
  - Condition
  - Principal
  - NotPrincipal
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [
      {
        Effect   = "Deny"
        Action   = "*"
        Resource = "*"
      },
      {
        Effect = "Allow"
        $0
      }
    ]
  })
}

---
exact: true
includes:
  - Sid
  - Effect
  - Principal
  - NotPrincipal
  - Action
  - NotAction
  - Resource
  - NotResource
  - Condition
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
        Effect   = "Allow"
        Action   = "s3:GetObject"
        Resource = "*"
      },
      {
        $0
      }
    ]
  })
}

---
includes:
  - s3:GetObject
excludes:
  - lambda:InvokeFunction
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
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3$0"
      ]
    }]
  })
}

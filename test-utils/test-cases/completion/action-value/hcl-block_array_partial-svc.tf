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
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = [
      "s3$0"
    ]
  }
}

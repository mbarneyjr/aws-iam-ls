---
includes:
  - s3
excludes:
  - lambda
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

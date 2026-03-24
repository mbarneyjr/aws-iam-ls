---
includes:
  - ":"
excludes:
  - us-east-1
  - us-west-2
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["iam:GetRole"]
    resources = [
      "arn:aws:iam:$0
    ]
  }
}

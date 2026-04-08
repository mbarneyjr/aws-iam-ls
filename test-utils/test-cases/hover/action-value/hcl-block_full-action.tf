---
includes:
  - "iam:CreateUser"
  - Access Level
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["iam:Create$0User"]
  }
}

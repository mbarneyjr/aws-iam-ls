---
includes:
  - us-east-1
  - us-west-2
  - eu-west-1
excludes:
  - ":"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [
      "arn:aws:lambda:$0
    ]
  }
}

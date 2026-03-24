---
includes:
  - "arn:aws:lambda:us-east-1::"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["lambda:InvokeFunction"]
    resources = [
      "arn:aws:lambda:us-east-1:$0
    ]
  }
}

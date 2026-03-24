---
includes:
  - s3:GetObject
  - lambda:InvokeFunction
---
data "aws_iam_policy_document" "s3_write_only_policy_document" {
  statement {
    effect = "Allow"
    actions = [
      "$0
    ]
  }
}

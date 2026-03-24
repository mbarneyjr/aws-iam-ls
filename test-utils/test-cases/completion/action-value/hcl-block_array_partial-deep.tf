---
includes:
  - s3:GetObject
excludes:
  - lambda:InvokeFunction
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = [
      "s3:G$0"
    ]
  }
}

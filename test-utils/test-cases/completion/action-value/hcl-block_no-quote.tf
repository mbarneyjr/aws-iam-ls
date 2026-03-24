---
includes: []
excludes:
  - s3:GetObject
  - lambda:InvokeFunction
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = [
      $0
    ]
  }
}

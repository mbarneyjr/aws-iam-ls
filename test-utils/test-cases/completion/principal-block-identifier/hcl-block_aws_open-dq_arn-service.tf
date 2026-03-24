---
includes:
  - "iam"
  - "sts"
excludes:
  - "s3"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:$0
    }
  }
}

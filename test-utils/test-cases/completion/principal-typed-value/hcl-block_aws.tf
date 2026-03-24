---
includes:
  - "*"
  - "${Account}"
  - "arn:${Partition}:iam::${Account}:root"
excludes:
  - "lambda.amazonaws.com"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["$0"]
    }
  }
}

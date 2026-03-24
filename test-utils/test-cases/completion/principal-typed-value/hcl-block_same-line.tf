---
includes:
  - "lambda.amazonaws.com"
  - "s3.amazonaws.com"
excludes:
  - "*"
  - "arn:${Partition}:iam::${Account}:root"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["$0"]
    }
  }
}

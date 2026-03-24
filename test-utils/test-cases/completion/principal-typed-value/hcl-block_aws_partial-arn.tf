---
includes:
  - "aws"
  - "aws-cn"
  - "aws-us-gov"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:$0"]
    }
  }
}

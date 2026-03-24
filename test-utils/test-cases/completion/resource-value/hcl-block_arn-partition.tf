---
includes:
  - aws
  - aws-us-gov
  - aws-cn
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:$0
    ]
  }
}

---
includes:
  - object or objects
  - ARN
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    reso$0urces = ["*"]
  }
}

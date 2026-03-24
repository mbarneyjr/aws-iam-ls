---
includes:
  - "arn:aws:s3::123456789012:accesspoint/${AccessPointAlias}"
excludes:
  - "arn:aws:s3:::${BucketName}"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3::123456789012:$0
    ]
  }
}

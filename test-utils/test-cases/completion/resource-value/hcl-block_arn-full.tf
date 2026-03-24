---
includes:
  - "arn:aws:s3:us-east-1:123456789012:accesspoint/${AccessPointName}"
  - "arn:aws:s3:us-east-1:123456789012:job/${JobId}"
excludes:
  - "arn:aws:s3:::${BucketName}"
  - "arn:aws:s3:::${BucketName}/${ObjectName}"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:us-east-1:123456789012:$0
    ]
  }
}

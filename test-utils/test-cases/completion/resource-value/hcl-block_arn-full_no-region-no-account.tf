---
includes:
  - "arn:aws:s3:::${BucketName}"
  - "arn:aws:s3:::${BucketName}/${ObjectName}"
excludes:
  - "arn:aws:s3:::accesspoint/${AccessPointName}"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:::$0
    ]
  }
}

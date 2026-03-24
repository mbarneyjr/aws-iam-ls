---
excludes:
  - "arn:aws:s3:us-east-1::accesspoint/${AccessPointName}"
  - "arn:aws:s3:::${BucketName}"
---
data "aws_iam_policy_document" "example" {
  statement {
    effect = "Allow"
    actions = ["s3:GetObject"]
    resources = [
      "arn:aws:s3:us-east-1::$0
    ]
  }
}

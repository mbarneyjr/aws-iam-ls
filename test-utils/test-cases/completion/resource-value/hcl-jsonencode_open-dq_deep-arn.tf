---
includes:
  - "arn:aws:s3::123456789012:accesspoint/${AccessPointAlias}"
excludes:
  - "arn:aws:s3:::${BucketName}"
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        "arn:aws:s3::123456789012:$0
      ]
    }]
  })
}

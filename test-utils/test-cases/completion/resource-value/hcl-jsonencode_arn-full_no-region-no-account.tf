---
includes:
  - "arn:aws:s3:::${BucketName}"
  - "arn:aws:s3:::${BucketName}/${ObjectName}"
excludes:
  - "arn:aws:s3:::accesspoint/${AccessPointName}"
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = ["s3:GetObject"]
      Resource = [
        "arn:aws:s3:::$0
      ]
    }]
  })
}

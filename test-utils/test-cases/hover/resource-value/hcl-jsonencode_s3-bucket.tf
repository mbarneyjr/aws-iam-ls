---
includes:
  - bucket
---
resource "aws_iam_policy" "example" {
  policy = jsonencode({
    Statement = [
      {
        Effect = "Allow"
        Action = ["s3:GetObject"]
        Resource = "arn:aws:s3:::my-$0bucket"
      }
    ]
  })
}

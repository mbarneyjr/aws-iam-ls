---
includes:
  - "lambda.amazonaws.com"
  - "s3.amazonaws.com"
excludes:
  - "*"
  - "arn:${Partition}:iam::${Account}:root"
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          Service = ["$0"]
        }
      }
    ]
  })
}

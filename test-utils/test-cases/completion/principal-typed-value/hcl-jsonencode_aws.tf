---
includes:
  - "*"
  - "${Account}"
  - "arn:${Partition}:iam::${Account}:root"
excludes:
  - "lambda.amazonaws.com"
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          AWS = ["$0"]
        }
      }
    ]
  })
}

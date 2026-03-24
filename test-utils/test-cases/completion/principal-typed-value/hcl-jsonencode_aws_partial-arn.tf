---
includes:
  - "aws"
  - "aws-cn"
  - "aws-us-gov"
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          AWS = ["arn:$0"]
        }
      }
    ]
  })
}

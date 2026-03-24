---
includes:
  - "Service"
  - "Federated"
  - "CanonicalUser"
excludes:
  - "AWS"
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          AWS = ["arn:aws:iam::123456789012:root"]
          $0
        }
      }
    ]
  })
}

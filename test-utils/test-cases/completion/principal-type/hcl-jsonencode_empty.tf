---
includes:
  - "AWS"
  - "Service"
  - "Federated"
  - "CanonicalUser"
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          "$0"
        }
      }
    ]
  })
}

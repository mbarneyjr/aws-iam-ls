---
includes:
  - AWS
  - Federated
  - CanonicalUser
excludes:
  - "cognito-identity.amazonaws.com"
  - "lambda.amazonaws.com"
  - Sid
  - Condition
---
resource "aws_iam_role" "example" {
  assume_role_policy = jsonencode({
    Statement = [
      {
        Effect    = "Allow"
        Action    = "sts:AssumeRole"
        Principal = {
          Service = ["events.amazonaws.com"]
          $0
        }
      }
    ]
  })
}

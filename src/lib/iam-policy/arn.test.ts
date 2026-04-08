import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseArn } from './arn.ts';
import { ServiceReference } from './reference/services.ts';

describe('parseArn', () => {
  it('parses a standard ARN', () => {
    const result = parseArn('arn:aws:s3:::my-bucket');
    assert.deepEqual(result, {
      partition: 'aws',
      service: 's3',
      region: '',
      account: '',
      resource: 'my-bucket',
    });
  });

  it('joins segments after the 5th colon into resource', () => {
    const result = parseArn('arn:aws:sns:us-east-1:123456789012:my-topic:sub-id');
    assert.equal(result!.resource, 'my-topic:sub-id');
  });

  it('returns null for bare wildcard', () => {
    assert.equal(parseArn('*'), null);
  });

  it('returns null for arn:*', () => {
    assert.equal(parseArn('arn:*'), null);
  });

  it('returns null for non-arn string', () => {
    assert.equal(parseArn('not-an-arn'), null);
  });
});

describe('ServiceReference.getResources', () => {
  it('matches s3 bucket', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:s3:::my-bucket')!);
    assert.equal(resources.length, 1);
    assert.equal(resources[0].name, 'bucket');
  });

  it('matches s3 object', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:s3:::my-bucket/key')!);
    assert.equal(resources.length, 1);
    assert.equal(resources[0].name, 'object');
  });

  it('matches ec2 instance with wildcard account', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:ec2:us-east-1:*:instance/*')!);
    assert.equal(resources.length, 1);
    assert.equal(resources[0].name, 'instance');
  });

  it('matches ec2 instance with ? wildcards', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:ec2:us-east-1:*:instance/i-???????????????????')!);
    assert.equal(resources.length, 1);
    assert.equal(resources[0].name, 'instance');
  });

  it('matches iam role', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:iam::123456789012:role/my-role')!);
    assert.equal(resources.length, 1);
    assert.equal(resources[0].name, 'role');
  });

  it('returns multiple matches for broad wildcard', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:s3:::*')!);
    assert.ok(resources.length > 1);
    assert.ok(resources.some((r) => r.name === 'bucket'));
    assert.ok(resources.some((r) => r.name === 'object'));
  });

  it('returns empty for unknown service', () => {
    const resources = ServiceReference.getResources(parseArn('arn:aws:fakeservice:us-east-1:123:thing/id')!);
    assert.deepEqual(resources, []);
  });
});

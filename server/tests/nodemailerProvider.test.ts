import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { NodemailerOtpProvider } from '../src/services/nodemailerOtpProvider.js';

// We mock nodemailer itself
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(),
  },
}));

describe('NodemailerOtpProvider', () => {
  let mockSendMail: ReturnType<typeof vi.fn>;
  let provider: NodemailerOtpProvider;

  beforeEach(() => {
    mockSendMail = vi.fn().mockResolvedValue(true);
    
    // Setup createTransport to return our mocked sendMail
    vi.mocked(nodemailer.createTransport).mockReturnValue({
      sendMail: mockSendMail,
    } as any);

    // Provide mocked env config implicitly through the global vi mock or just rely on the fallback defaults 
    // since config reads from process.env, let's just instantiate the provider.
    provider = new NodemailerOtpProvider();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully send an email without throwing', async () => {
    await expect(provider.sendChallenge('user@example.com', '123456', 'EMAIL')).resolves.not.toThrow();
    
    expect(mockSendMail).toHaveBeenCalledOnce();
    const mailOptions = mockSendMail.mock.calls[0][0];
    
    expect(mailOptions.to).toBe('user@example.com');
    expect(mailOptions.html).toContain('123456'); // The OTP must be in the HTML
    expect(mailOptions.subject).toContain('Verification');
  });

  it('should reject if delivery method is not EMAIL', async () => {
    await expect(provider.sendChallenge('user@example.com', '123456', 'SMS')).rejects.toThrow(/does not support delivery method: SMS/);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it('should throw securely if nodemailer fails to send', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('SMTP Connection Timeout'));
    
    // It should catch the internal error and throw a safe error
    await expect(provider.sendChallenge('user@example.com', '123456', 'EMAIL')).rejects.toThrow('Failed to send OTP challenge via SMTP.');
  });
});

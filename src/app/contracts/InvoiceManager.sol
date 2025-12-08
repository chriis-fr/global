// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

contract InvoiceManager {
    // Contract is fully implemented - not abstract
    struct Invoice {
        address issuer;
        address payer;
        address token; // address(0) for CELO
        uint256 amount;
        bool paid;
    }

    uint256 public feePercentage; // in basis points (10000 = 100%)
    uint256 public feeThreshold;  // minimum amount to apply fee
    address public feeRecipient;

    mapping(string => Invoice) public invoices;

    event InvoiceCreated(string invoiceId, address issuer, address payer, address token, uint256 amount);
    event InvoicePaid(string invoiceId, address payer, uint256 fee);

    constructor(uint256 _feePercentage, uint256 _feeThreshold, address _feeRecipient) {
        feePercentage = _feePercentage;
        feeThreshold = _feeThreshold;
        feeRecipient = _feeRecipient;
    }

    function createInvoice(
        string memory invoiceId,
        address payer,
        address token,
        uint256 amount
    ) external {
        require(invoices[invoiceId].issuer == address(0), "Invoice exists");

        invoices[invoiceId] = Invoice({
            issuer: msg.sender,
            payer: payer,
            token: token,
            amount: amount,
            paid: false
        });

        emit InvoiceCreated(invoiceId, msg.sender, payer, token, amount);
    }

    function payInvoice(string memory invoiceId) external payable {
        Invoice storage inv = invoices[invoiceId];
        require(!inv.paid, "Invoice already paid");
        require(msg.sender == inv.payer, "Not the payer");

        uint256 fee = 0;
        if (inv.amount >= feeThreshold) {
            fee = (inv.amount * feePercentage) / 10000;
        }
        uint256 paymentAmount = inv.amount - fee;

        if (inv.token == address(0)) {
            // CELO payment
            require(msg.value >= inv.amount, "Insufficient CELO");
            if (fee > 0) payable(feeRecipient).transfer(fee);
            payable(inv.issuer).transfer(paymentAmount);
        } else {
            // ERC20 payment
            require(IERC20(inv.token).transferFrom(msg.sender, inv.issuer, paymentAmount), "ERC20 transfer failed");
            if (fee > 0) require(IERC20(inv.token).transferFrom(msg.sender, feeRecipient, fee), "ERC20 fee failed");
        }

        inv.paid = true;
        emit InvoicePaid(invoiceId, msg.sender, fee);
    }

    // Admin functions
    function updateFee(uint256 _feePercentage, uint256 _feeThreshold, address _feeRecipient) external {
        require(msg.sender == feeRecipient, "Only feeRecipient can update");
        feePercentage = _feePercentage;
        feeThreshold = _feeThreshold;
        feeRecipient = _feeRecipient;
    }
}

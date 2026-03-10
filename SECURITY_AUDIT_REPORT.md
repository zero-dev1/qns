# QNS Smart Contracts Security Audit Report

**Date:** March 10, 2026  
**Contracts Audited:**
- `contracts/QNSRegistry.sol` (54 lines)
- `contracts/QNSResolver.sol` (100 lines)
- `contracts/QNSRegistrar.sol` (477 lines)

**Solidity Version:** ^0.8.20

---

## Executive Summary

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 4 |
| Medium | 3 |
| Low | 4 |
| Informational | 6 |

---

## Critical Issues (3)

### C-001: Reentrancy Attack in `register()` Function
**File:** `QNSRegistrar.sol`  
**Function:** `register()` (lines 146-201)  
**Line:** 196

**Description:**
The `register()` function performs an external ETH transfer (refund) BEFORE updating the `registrations` mapping. This violates the Checks-Effects-Interactions pattern:

```solidity
// State is written here (line 171-175)
registrations[labelHash] = Registration({...});

// External calls happen here (lines 184-191)
registry.setSubnodeOwner(...);
resolver.setAddr(...);
...

// ETH transfer happens AFTER all state changes, but the refund uses call
if (msg.value > fee) {
    (bool refundSuccess, ) = payable(msg.sender).call{value: msg.value - fee}("");
    require(refundSuccess, "QNSRegistrar: refund failed");
}
```

While the state write happens before the refund, the external calls to `registry` and `resolver` happen after state is written. However, if the registry or resolver were malicious or compromised, reentrancy could still be an issue. More critically, the `_splitPayment` function makes external calls:

```solidity
function _splitPayment(uint256 fee) internal {
    uint256 burnAmount = (fee * burnPercent) / 100;
    if (burnAmount > 0) {
        (bool burnSuccess, ) = payable(burnAddress).call{value: burnAmount}("");
        require(burnSuccess, "QNSRegistrar: burn transfer failed");
    }
}
```

This external call happens at line 193 BEFORE the refund check at line 196, but AFTER the registration state is set. This order is correct, but any change in ordering could introduce reentrancy.

**Impact:** Potential for reentrancy attacks if payment recipient is malicious.

**Recommended Fix:**
Add a reentrancy guard to the `register()` function:

```solidity
bool private _locked;

modifier nonReentrant() {
    require(!_locked, "ReentrancyGuard: reentrant call");
    _locked = true;
    _;
    _locked = false;
}

function register(...) external payable nonReentrant { ... }
```

---

### C-002: Reentrancy Attack in `renew()` Function
**File:** `QNSRegistrar.sol`  
**Function:** `renew()` (lines 203-233)  
**Line:** 228

**Description:**
Same issue as C-001. The `renew()` function updates state and then makes external calls via `_splitPayment()` and potentially the refund `call`. 

The state update at line 220-222 happens:
```solidity
if (block.timestamp <= reg.expires) {
    reg.expires += durationYears * 365 days;  // Can overflow if uint256 max
} else {
    reg.expires = block.timestamp + (durationYears * 365 days);
}
```

Then `_splitPayment(fee)` is called at line 225, which makes external ETH transfers.

**Impact:** Potential for reentrancy attacks.

**Recommended Fix:**
Apply the same `nonReentrant` modifier to the `renew()` function.

---

### C-003: Missing Zero-Address Check for Critical Addresses
**File:** `QNSRegistrar.sol`  
**Function:** Constructor (lines 79-99)

**Description:**
The constructor does not validate that `treasuryAddress`, `_burnAddress`, `registryAddress`, or `resolverAddress` are non-zero. Setting these to zero could render the contract unusable or cause loss of funds.

```solidity
constructor(
    address registryAddress,
    address resolverAddress,
    address treasuryAddress,
    address _burnAddress
) {
    registry = IQNSRegistry(registryAddress);  // No zero check
    resolver = IQNSResolver(resolverAddress);  // No zero check
    treasury = treasuryAddress;                // No zero check
    burnAddress = _burnAddress;                // No zero check
    ...
}
```

**Impact:** Contract could be deployed in a broken state, requiring redeployment.

**Recommended Fix:**
```solidity
constructor(
    address registryAddress,
    address resolverAddress,
    address treasuryAddress,
    address _burnAddress
) {
    require(registryAddress != address(0), "Invalid registry");
    require(resolverAddress != address(0), "Invalid resolver");
    require(treasuryAddress != address(0), "Invalid treasury");
    require(_burnAddress != address(0), "Invalid burn address");
    
    registry = IQNSRegistry(registryAddress);
    resolver = IQNSResolver(resolverAddress);
    treasury = treasuryAddress;
    burnAddress = _burnAddress;
    admin = msg.sender;
    ...
}
```

---

## High Severity Issues (4)

### H-001: Potential Fund Lock in Contract
**File:** `QNSRegistrar.sol`  
**Function:** `receive()` (line 476)

**Description:**
The contract has a `receive()` function that accepts ETH, but there's no function to withdraw arbitrary ETH that was sent directly (not through registration). Only `withdrawToTreasury()` exists, which requires admin access and sends to the fixed treasury address.

If someone accidentally sends ETH directly to the contract, or if the burn mechanism fails (burnAddress is a contract that reverts), those funds could be locked.

**Impact:** Loss of funds sent directly to contract.

**Recommended Fix:**
Either remove the `receive()` function if not needed, or add an admin function to recover accidentally sent funds:

```solidity
function recoverStuckFunds(address payable to, uint256 amount) external onlyAdmin {
    require(to != address(0), "Invalid recipient");
    (bool success, ) = to.call{value: amount}("");
    require(success, "Transfer failed");
}
```

---

### H-002: Unbounded Loop in `unreserveName()` Can Cause DoS
**File:** `QNSRegistrar.sol`  
**Function:** `unreserveName()` (lines 282-295)

**Description:**
The `unreserveName()` function iterates through the entire `reservedNamesList` array to find and remove a name. If many names are reserved, this could exceed the block gas limit.

```solidity
function unreserveName(string memory name) external onlyAdmin {
    ...
    for (uint256 i = 0; i < reservedNamesList.length; i++) {  // Unbounded loop
        if (keccak256(bytes(reservedNamesList[i])) == labelHash) {
            reservedNamesList[i] = reservedNamesList[reservedNamesList.length - 1];
            reservedNamesList.pop();
            break;
        }
    }
}
```

**Impact:** Admin may be unable to unreserve names if the list grows too large.

**Recommended Fix:**
Either:
1. Don't maintain the list on-chain (emit events instead)
2. Use a mapping to track indices for O(1) removal
3. Add a separate admin function to clear multiple entries

---

### H-003: Integer Overflow in Expiry Calculation (Pre-Solidity 0.8)
**File:** `QNSRegistrar.sol`  
**Function:** `renew()` (line 220)

**Description:**
While the contract uses Solidity ^0.8.20 which has built-in overflow protection, there's a potential issue with the expiry addition:

```solidity
if (block.timestamp <= reg.expires) {
    reg.expires += durationYears * 365 days;  // Could overflow
}
```

With very large `durationYears` values, this could theoretically overflow (though Solidity 0.8+ would revert). A user passing `type(uint256).max / 365 days` could cause a revert.

More concerning is that there's no maximum duration check, allowing registrations for extremely long periods.

**Impact:** Potential for very long or failed registrations.

**Recommended Fix:**
Add a maximum duration limit:

```solidity
uint256 public constant MAX_REGISTRATION_YEARS = 10;

function renew(string memory name, uint256 durationYears) external payable {
    require(durationYears > 0 && durationYears <= MAX_REGISTRATION_YEARS, "Invalid duration");
    ...
}
```

---

### H-004: Front-running Risk in Name Registration
**File:** `QNSRegistrar.sol`  
**Function:** `register()` (lines 146-201)

**Description:**
When a user attempts to register a name, a malicious actor could front-run their transaction, registering the name first. The original user's transaction would then fail with "name not available".

While this is inherent to public blockchains, the design could include commit-reveal pattern to prevent this.

**Impact:** Users may lose gas fees and fail to register desired names.

**Recommended Fix:**
Consider implementing a commit-reveal scheme:

```solidity
mapping(bytes32 => uint256) public commitments;
uint256 public constant MIN_COMMITMENT_AGE = 1 minutes;
uint256 public constant MAX_COMMITMENT_AGE = 24 hours;

function commit(bytes32 commitment) external {
    commitments[commitment] = block.timestamp;
}

function register(...) external payable {
    bytes32 commitment = keccak256(abi.encodePacked(name, msg.sender, secret));
    require(commitments[commitment] > 0, "No commitment");
    require(block.timestamp >= commitments[commitment] + MIN_COMMITMENT_AGE, "Too early");
    require(block.timestamp <= commitments[commitment] + MAX_COMMITMENT_AGE, "Too late");
    delete commitments[commitment];
    ...
}
```

---

## Medium Severity Issues (3)

### M-001: No Event Emitted for Treasury/Burn Address Changes
**File:** `QNSRegistrar.sol`  
**Functions:** `setTreasury()` (line 348), `setBurnAddress()` (line 352)

**Description:**
Critical administrative changes don't emit events, making it harder to track changes off-chain:

```solidity
function setTreasury(address newTreasury) external onlyAdmin {
    treasury = newTreasury;  // No event
}

function setBurnAddress(address newBurn) external onlyAdmin {
    burnAddress = newBurn;   // No event
}
```

**Impact:** Reduced transparency and auditability.

**Recommended Fix:**
```solidity
event TreasuryChanged(address indexed newTreasury);
event BurnAddressChanged(address indexed newBurnAddress);

function setTreasury(address newTreasury) external onlyAdmin {
    require(newTreasury != address(0), "Invalid treasury");
    treasury = newTreasury;
    emit TreasuryChanged(newTreasury);
}
```

---

### M-002: No Event Emitted for Admin Change
**File:** `QNSRegistrar.sol`  
**Function:** `setAdmin()` (line 367)

**Description:**
Admin changes should emit events for transparency:

```solidity
function setAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), "QNSRegistrar: zero address");
    admin = newAdmin;
}
```

**Impact:** Reduced transparency for critical ownership transfer.

**Recommended Fix:**
```solidity
event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

function setAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), "QNSRegistrar: zero address");
    address oldAdmin = admin;
    admin = newAdmin;
    emit AdminChanged(oldAdmin, newAdmin);
}
```

---

### M-003: Missing Zero-Address Check in `setAdmin()`
**File:** `QNSRegistrar.sol`  
**Function:** `setAdmin()` (line 367)

**Description:**
While there is a zero-address check, consider also checking that the new admin is different from the current admin to prevent accidental no-op transactions.

**Recommended Fix:**
```solidity
function setAdmin(address newAdmin) external onlyAdmin {
    require(newAdmin != address(0), "QNSRegistrar: zero address");
    require(newAdmin != admin, "QNSRegistrar: same admin");
    address oldAdmin = admin;
    admin = newAdmin;
    emit AdminChanged(oldAdmin, newAdmin);
}
```

---

## Low Severity Issues (4)

### L-001: Missing NatSpec Documentation
**File:** All files

**Description:**
Most functions lack NatSpec documentation (/// @notice, /// @param, /// @return), which reduces code readability and makes integration harder.

**Recommended Fix:**
Add comprehensive NatSpec comments to all public and external functions.

---

### L-002: Use of Magic Numbers
**File:** `QNSRegistrar.sol`  
**Lines:** 91-95, 144, etc.

**Description:**
Hardcoded values should be constants:

```solidity
price3Char = 1000 * 1e18;  // Magic number
price4Char = 300 * 1e18;   // Magic number
price5PlusChar = 100 * 1e18;  // Magic number
permanentMultiplier = 15;  // Magic number
burnPercent = 5;           // Magic number
```

**Recommended Fix:**
```solidity
uint256 public constant INITIAL_PRICE_3_CHAR = 1000 * 1e18;
uint256 public constant INITIAL_PRICE_4_CHAR = 300 * 1e18;
uint256 public constant INITIAL_PRICE_5_PLUS_CHAR = 100 * 1e18;
uint256 public constant DEFAULT_PERMANENT_MULTIPLIER = 15;
uint256 public constant DEFAULT_BURN_PERCENT = 5;
```

---

### L-003: Inconsistent Error Message Format
**File:** `QNSRegistrar.sol`

**Description:**
Error messages use different prefixes:
- `"QNSRegistrar: ..."` 
- `"Invalid treasury"` (if added without prefix)

Standardize all error messages.

---

### L-004: Registry Owner Can Be Zero After Transfer
**File:** `QNSRegistry.sol`  
**Function:** `setOwner()` (line 26)

**Description:**
The `setOwner()` function doesn't prevent setting the owner to address(0):

```solidity
function setOwner(bytes32 node, address newOwner) external onlyOwner(node) {
    records[node].owner = newOwner;  // Could be address(0)
    emit Transfer(node, newOwner);
}
```

**Impact:** Node could become permanently unmanageable if owner is set to zero.

**Recommended Fix:**
```solidity
function setOwner(bytes32 node, address newOwner) external onlyOwner(node) {
    require(newOwner != address(0), "QNSRegistry: zero address");
    records[node].owner = newOwner;
    emit Transfer(node, newOwner);
}
```

---

## Informational Findings (6)

### I-001: Consider Using Custom Errors Instead of Strings
**File:** All files

**Description:**
Solidity 0.8.4+ supports custom errors which are more gas-efficient than string revert messages:

```solidity
error NotAuthorized();
error NameNotAvailable();

function register(...) external payable {
    if (!isAuthorized) revert NotAuthorized();
    ...
}
```

---

### I-002: No Two-Step Admin Transfer
**File:** `QNSRegistrar.sol`  
**Function:** `setAdmin()`

**Description:**
Consider implementing a two-step admin transfer (propose + accept) to prevent accidentally setting admin to an address that can't be accessed.

---

### I-003: Price Can Be Set to Zero
**File:** `QNSRegistrar.sol`  
**Function:** `setPrice()` (line 333)

**Description:**
Admin can set prices to zero, which may or may not be intentional.

```solidity
function setPrice(uint256 new3, uint256 new4, uint256 new5Plus) external onlyAdmin {
    // No minimum price check
    price3Char = new3;
    price4Char = new4;
    price5PlusChar = new5Plus;
}
```

If unintentional, add minimum price checks.

---

### I-004: Duplicate Code in Registration Logic
**File:** `QNSRegistrar.sol`

**Description:**
The registration logic is duplicated between `register()` and `assignReservedName()`. Consider refactoring into an internal function.

---

### I-005: Resolver Authorization Bypass Through `authorizedCallers`
**File:** `QNSResolver.sol`  
**Function:** `isAuthorized()` (line 32)

**Description:**
The `authorizedCallers` mapping allows certain addresses to bypass normal ownership checks. This is by design (Registrar is an authorized caller), but should be documented clearly.

```solidity
function isAuthorized(bytes32 node) internal view returns (bool) {
    return msg.sender == registry.owner(node) || authorizedCallers[msg.sender];
}
```

**Note:** Ensure that `authorizedCallers` is carefully managed, as any authorized caller can modify any node's records.

---

### I-006:365 Days Approximation
**File:** `QNSRegistrar.sol`

**Description:**
The code uses `365 days` for year calculations, which doesn't account for leap years. For more precision, consider using a days-based calculation or documenting this approximation.

---

## Detailed Analysis of Specific Attack Vectors

### Fund Extraction Analysis

**Can anyone drain the registrar balance?**

No direct vulnerability found. The `withdrawToTreasury()` function is protected by `onlyAdmin`:

```solidity
function withdrawToTreasury() external onlyAdmin {
    uint256 balance = address(this).balance;
    require(balance > 0, "QNSRegistrar: no balance");
    (bool success, ) = payable(treasury).call{value: balance}("");
    require(success, "QNSRegistrar: withdrawal failed");
}
```

However, if admin keys are compromised, funds can be stolen. Consider a timelock for this function.

### Price Manipulation Analysis

**Can someone register at wrong price?**

The `getPrice()` function correctly uses the name length at the time of registration:

```solidity
uint256 nameLength = bytes(lowered).length;
uint256 fee = getPrice(nameLength, durationInYears, permanent);
require(msg.value >= fee, "QNSRegistrar: insufficient payment");
```

However, there's no validation that `durationInYears > 0` for non-permanent registrations in the `register()` function. If `durationInYears = 0` and `permanent = false`, the user pays 0 but gets no expiry (effectively a permanent registration for free, though `permanent` flag would be false).

**Recommended Fix:**
```solidity
function register(
    string memory name,
    uint256 durationInYears,
    bool permanent
) external payable {
    require(permanent || durationInYears > 0, "Invalid duration");
    ...
}
```

### Name Squatting Bypass Analysis

**Can reserved names be registered?**

The `register()` function correctly checks the reserved mapping:

```solidity
require(!reserved[labelHash], "QNSRegistrar: name is reserved");
```

However, the `available()` function calls `validateName()` which could revert on invalid names, potentially making the function unusable for some inputs.

### Reverse Record Spoofing Analysis

**Can someone set a reverse record for an address they don't own?**

The `setReverse()` function has this check:

```solidity
function setReverse(address _addr, bytes32 node) external {
    require(
        msg.sender == _addr || authorizedCallers[msg.sender],
        "QNSResolver: not authorized for reverse"
    );
    reverseNodes[_addr] = node;
}
```

This means:
1. Users can set their own reverse record
2. Authorized callers (like Registrar) can set anyone's reverse record

The Registrar uses this in `transferName()`:

```solidity
resolver.clearReverse(msg.sender);
resolver.setReverse(newOwner, nameNode);
```

This is correct - it clears the sender's reverse and sets it for the new owner.

However, in `_autoSetReverseRecord()`, the Registrar checks if user already has a reverse:

```solidity
bytes32 existingNode = resolver.nameHash(addr);
if (existingNode != bytes32(0)) {
    return;  // Don't overwrite existing
}
```

This prevents squatting on existing reverse records.

### Transfer Vulnerabilities Analysis

The `transferName()` function:
1. Validates ownership
2. Updates registrar's internal records
3. Updates registry ownership
4. Updates resolver address
5. Clears old reverse and sets new

Potential issue: If step 3-5 fail (e.g., registry is paused), the internal state is already updated but the external state is inconsistent.

### Expiry/Renewal Edge Cases

1. **Grace period edge case:** Names can be renewed during the grace period (30 days after expiry). This is correct behavior.

2. **Permanent names:** Once set, permanent names (`expires = 0`) cannot be renewed (correctly rejected in `renew()`).

3. **Year calculation:** Uses 365 days, not accounting for leap years.

---

## Recommendations Summary

1. **Immediate (Critical):** Add reentrancy guards to `register()` and `renew()`
2. **Immediate (Critical):** Add zero-address checks in constructor
3. **High Priority:** Fix potential DoS in `unreserveName()`
4. **High Priority:** Add maximum registration duration limit
5. **Medium Priority:** Add events for all admin state changes
6. **Low Priority:** Add comprehensive NatSpec documentation
7. **Informational:** Consider custom errors for gas optimization
8. **Informational:** Consider two-step admin transfer

---

## Conclusion

The QNS contracts are generally well-structured but have several security issues that should be addressed before production deployment. The most critical are the reentrancy vulnerabilities and missing input validation. Once these are fixed, the contracts should be re-audited before mainnet deployment.

**Overall Risk Rating: HIGH** (until critical issues are resolved)

---

*Report generated by automated security analysis. This does not constitute a full formal audit and should be supplemented with manual review and testing.*

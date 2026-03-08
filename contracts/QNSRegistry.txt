// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract QNSRegistry {

    struct Record {
        address owner;
        address resolver;
    }

    mapping(bytes32 => Record) public records;

    event Transfer(bytes32 indexed node, address newOwner);
    event NewResolver(bytes32 indexed node, address resolver);
    event NewOwner(bytes32 indexed node, bytes32 indexed labelHash, address newOwner);

    modifier onlyOwner(bytes32 node) {
        require(msg.sender == records[node].owner, "QNSRegistry: not node owner");
        _;
    }

    constructor() {
        records[bytes32(0)].owner = msg.sender;
    }

    function setOwner(bytes32 node, address newOwner) external onlyOwner(node) {
        records[node].owner = newOwner;
        emit Transfer(node, newOwner);
    }

    function setResolver(bytes32 node, address _resolver) external onlyOwner(node) {
        records[node].resolver = _resolver;
        emit NewResolver(node, _resolver);
    }

    function setSubnodeOwner(
        bytes32 node,
        bytes32 labelHash,
        address newOwner
    ) external onlyOwner(node) returns (bytes32) {
        bytes32 subnode = keccak256(abi.encodePacked(node, labelHash));
        records[subnode].owner = newOwner;
        emit NewOwner(node, labelHash, newOwner);
        return subnode;
    }

    function owner(bytes32 node) public view returns (address) {
        return records[node].owner;
    }

    function resolver(bytes32 node) public view returns (address) {
        return records[node].resolver;
    }
}

<?php
$host = "localhost";
$username = "root";
$password = "";
$database = "rubric_database";

$conn = new mysqli($host, $username, $password);

$conn->query("CREATE DATABASE IF NOT EXISTS `$database`");
$conn->select_db($database);

if ($conn->connect_error) {
    die(json_encode(["status" => "error", "message" => "Connection failed: " . $conn->connect_error]));
}

$conn->query("CREATE TABLE IF NOT EXISTS accounts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor_name VARCHAR(255) NOT NULL,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    status ENUM('pending','approved') DEFAULT 'approved'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS group_ratings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rater_name VARCHAR(255) NOT NULL,
    group_name VARCHAR(100) NOT NULL,
    rating_number INT DEFAULT 1,
    content_accuracy INT DEFAULT 0,
    understanding_topic INT DEFAULT 0,
    organization_structure INT DEFAULT 0,
    delivery_communication INT DEFAULT 0,
    audience_engagement INT DEFAULT 0,
    visual_aids INT DEFAULT 0,
    professional_appearance INT DEFAULT 0,
    teamwork_collaboration INT DEFAULT 0,
    time_allocation INT DEFAULT 0,
    strategies INT DEFAULT 0,
    total_score INT DEFAULT 0,
    instructor VARCHAR(255) DEFAULT '',
    UNIQUE KEY unique_group_rate (rater_name, group_name, rating_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS groups_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_name VARCHAR(255) NOT NULL,
    instructor VARCHAR(255),
    member1_name VARCHAR(255) DEFAULT '',
    member2_name VARCHAR(255) DEFAULT '',
    member3_name VARCHAR(255) DEFAULT '',
    is_closed TINYINT(1) DEFAULT 0,
    UNIQUE KEY unique_group_instructor (group_name, instructor)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->query("CREATE TABLE IF NOT EXISTS rate_status (
    id INT AUTO_INCREMENT PRIMARY KEY,
    instructor VARCHAR(255) NOT NULL,
    rate_number INT NOT NULL,
    is_locked TINYINT(1) DEFAULT 0,
    UNIQUE KEY unique_rate_instructor (instructor, rate_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$conn->set_charset("utf8mb4");
?>



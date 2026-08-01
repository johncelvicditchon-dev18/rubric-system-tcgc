<?php
include __DIR__ . '/../includes/db_connect.php';
header('Content-Type: application/json');

if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $instructor = $_POST['instructor'] ?? '';
    $section_name = $_POST['section_name'] ?? '';

    if (empty($instructor) || empty($section_name)) {
        echo json_encode(["status" => "error", "message" => "instructor and section_name required"]);
        exit;
    }

    $s1 = $conn->prepare("DELETE FROM group_ratings WHERE instructor=? AND section=?");
    $s1->bind_param("ss", $instructor, $section_name);
    $s1->execute();
    $s1->close();

    $s2 = $conn->prepare("DELETE FROM groups_table WHERE instructor=? AND section=?");
    $s2->bind_param("ss", $instructor, $section_name);
    $s2->execute();
    $s2->close();

    $s3 = $conn->prepare("DELETE FROM section_config WHERE instructor=? AND section_name=?");
    $s3->bind_param("ss", $instructor, $section_name);
    $s3->execute();
    $s3->close();

    echo json_encode(["status" => "success", "message" => "Section and all its data deleted"]);
}
$conn->close();
?>

-- MySQL dump 10.13  Distrib 8.0.41, for Linux (x86_64)
--
-- Host: localhost    Database: folkout
-- ------------------------------------------------------
-- Server version	8.0.41-0ubuntu0.24.04.1

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `comments`
--

DROP TABLE IF EXISTS `comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `comments` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `post_id` char(36) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_in_library` tinyint(1) DEFAULT '0',
  `user_id` int DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `fk_user_id` (`user_id`),
  KEY `comments_ibfk_1` (`post_id`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_user_id` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `comments`
--

LOCK TABLES `comments` WRITE;
/*!40000 ALTER TABLE `comments` DISABLE KEYS */;
INSERT INTO `comments` VALUES ('d4f432f0-a3b0-40bd-a7d5-fcf9a2a3e191','0fc79efe-095a-439d-8075-89c24c7394b6','いらっしゃい','2025-02-04 10:04:08',0,6),('ea53b3f5-5ca1-4f63-b331-f302b2548551','83e9bfe8-850f-4bd5-a170-d0aa9f33ab95','うけるｗ','2025-02-04 09:44:43',0,6);
/*!40000 ALTER TABLE `comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `groups`
--

DROP TABLE IF EXISTS `groups`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `groups` (
  `id` int NOT NULL AUTO_INCREMENT,
  `representative_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `groups`
--

LOCK TABLES `groups` WRITE;
/*!40000 ALTER TABLE `groups` DISABLE KEYS */;
INSERT INTO `groups` VALUES (1,NULL,'2025-01-03 04:16:27','2025-01-03 04:16:27'),(2,NULL,'2025-01-07 00:16:11','2025-01-07 00:16:11');
/*!40000 ALTER TABLE `groups` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `histories`
--

DROP TABLE IF EXISTS `histories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `histories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `group_id` int NOT NULL,
  `vote_action_id` char(36) NOT NULL,
  `action` varchar(255) DEFAULT NULL,
  `reason` text,
  `yes` int DEFAULT NULL,
  `no` int DEFAULT NULL,
  `resolved` tinyint(1) DEFAULT NULL,
  `deadline` datetime DEFAULT NULL,
  `target_user` varchar(255) DEFAULT NULL,
  `representative` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `histories`
--

LOCK TABLES `histories` WRITE;
/*!40000 ALTER TABLE `histories` DISABLE KEYS */;
INSERT INTO `histories` VALUES (18,1,'fd26a8bd-fe75-4d14-9658-d9a1bc4edf98','追放','信者は要らない',5,1,1,'2025-02-08 10:53:52','user1の信者1','☆皇帝☆','2025-02-08 10:53:51');
/*!40000 ALTER TABLE `histories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `messages`
--

DROP TABLE IF EXISTS `messages`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_read` tinyint DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`),
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `messages`
--

LOCK TABLES `messages` WRITE;
/*!40000 ALTER TABLE `messages` DISABLE KEYS */;
/*!40000 ALTER TABLE `messages` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `posts`
--

DROP TABLE IF EXISTS `posts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `posts` (
  `id` char(36) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_in_library` tinyint(1) DEFAULT '0',
  `user_id` int NOT NULL,
  `group_id` int NOT NULL,
  `tag` varchar(255) DEFAULT NULL,
  `added_to_library_at` datetime DEFAULT NULL,
  `last_editor_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `posts`
--

LOCK TABLES `posts` WRITE;
/*!40000 ALTER TABLE `posts` DISABLE KEYS */;
INSERT INTO `posts` VALUES ('0fc79efe-095a-439d-8075-89c24c7394b6','なにこれ','2025-02-04 10:03:53',1,7,1,'ゴミ箱','2025-02-04 19:39:52',1),('83e9bfe8-850f-4bd5-a170-d0aa9f33ab95','あつはなついなぁ、とかいって。ぶへへ','2025-02-01 14:58:47',1,1,1,'聖書','2025-02-04 18:44:07',2);
/*!40000 ALTER TABLE `posts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `representative_votes`
--

DROP TABLE IF EXISTS `representative_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `representative_votes` (
  `voter_id` int NOT NULL,
  `group_id` int NOT NULL,
  `candidate_id` int NOT NULL,
  PRIMARY KEY (`group_id`,`voter_id`),
  UNIQUE KEY `unique_voter` (`voter_id`),
  KEY `candidate_id` (`candidate_id`),
  CONSTRAINT `fk_candidate_id` FOREIGN KEY (`candidate_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_voter_id` FOREIGN KEY (`voter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `representative_votes`
--

LOCK TABLES `representative_votes` WRITE;
/*!40000 ALTER TABLE `representative_votes` DISABLE KEYS */;
INSERT INTO `representative_votes` VALUES (1,1,1),(3,1,1),(6,1,7),(7,1,7),(8,1,7),(9,1,7);
/*!40000 ALTER TABLE `representative_votes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tags`
--

DROP TABLE IF EXISTS `tags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tags` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `group_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_name_group` (`name`,`group_id`)
) ENGINE=InnoDB AUTO_INCREMENT=33 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tags`
--

LOCK TABLES `tags` WRITE;
/*!40000 ALTER TABLE `tags` DISABLE KEYS */;
INSERT INTO `tags` VALUES (26,'聖書',1,'2025-02-02 13:45:56'),(32,'ゴミ箱',1,'2025-02-10 13:54:15');
/*!40000 ALTER TABLE `tags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nickname` varchar(50) DEFAULT NULL,
  `icon` varchar(255) DEFAULT NULL,
  `group_id` int DEFAULT NULL,
  `secret_key` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `auth_id` (`secret_key`),
  UNIQUE KEY `auth_id_2` (`secret_key`),
  UNIQUE KEY `secret_key` (`secret_key`),
  KEY `fk_users_group` (`group_id`),
  KEY `idx_last_login` (`last_login`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'user1','/uploads/1.jpeg',1,'8d4e25af027859f4dafddbd497df2a56',1,'2025-02-21 15:26:32','2025-04-10 01:28:18'),(3,'user1の信者2',NULL,1,'f7c37328c4e500032eaf699e1ecf10f6',1,'2025-02-21 15:26:32','2025-02-21 15:41:36'),(6,'☆皇帝☆',NULL,1,'d2c837f26d7f8e5a7575177c9ca6d235',1,'2025-02-21 15:26:32','2025-02-21 15:41:36'),(7,'user7',NULL,1,'125f67353380714e70d6100f0228a61f',1,'2025-02-21 15:26:32','2025-02-21 15:41:36'),(8,'user8',NULL,1,'76920cf27cb5d7c2d96b8e3fbb4c2add',1,'2025-02-21 15:26:32','2025-02-21 15:41:36'),(9,'user9',NULL,1,'07dc7085c3b9d2cc5847caf315effeb2',1,'2025-02-21 15:26:32','2025-02-21 15:47:04');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!50003 SET @saved_cs_client      = @@character_set_client */ ;
/*!50003 SET @saved_cs_results     = @@character_set_results */ ;
/*!50003 SET @saved_col_connection = @@collation_connection */ ;
/*!50003 SET character_set_client  = utf8mb4 */ ;
/*!50003 SET character_set_results = utf8mb4 */ ;
/*!50003 SET collation_connection  = utf8mb4_0900_ai_ci */ ;
/*!50003 SET @saved_sql_mode       = @@sql_mode */ ;
/*!50003 SET sql_mode              = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION' */ ;
DELIMITER ;;
/*!50003 CREATE*/ /*!50017 DEFINER=`root`@`localhost`*/ /*!50003 TRIGGER `assign_group_id` BEFORE INSERT ON `users` FOR EACH ROW BEGIN
    DECLARE available_group INT;

    
    SELECT id INTO available_group
    FROM `groups`
    WHERE NOT EXISTS (
        SELECT 1
        FROM users
        WHERE group_id = `groups`.id
        GROUP BY group_id
        HAVING COUNT(*) >= 50
    )
    LIMIT 1;

    
    IF available_group IS NULL THEN
        INSERT INTO `groups` (representative_id) VALUES (NULL);
        SET available_group = LAST_INSERT_ID();
    END IF;

    
    SET NEW.group_id = available_group;
END */;;
DELIMITER ;
/*!50003 SET sql_mode              = @saved_sql_mode */ ;
/*!50003 SET character_set_client  = @saved_cs_client */ ;
/*!50003 SET character_set_results = @saved_cs_results */ ;
/*!50003 SET collation_connection  = @saved_col_connection */ ;

--
-- Table structure for table `vote_actions`
--

DROP TABLE IF EXISTS `vote_actions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vote_actions` (
  `id` char(36) NOT NULL DEFAULT (uuid()),
  `type` enum('代表者投票','投票') NOT NULL,
  `action` enum('追放','サーバークローズド化','禁止用語','解散') DEFAULT NULL,
  `reason` text,
  `resolved` tinyint(1) DEFAULT '0',
  `deadline` datetime DEFAULT NULL,
  `user_id` int DEFAULT NULL,
  `target_user_id` int DEFAULT NULL,
  `group_id` int NOT NULL,
  `representative_name` varchar(255) DEFAULT NULL,
  `target_user_name` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `target_user_id` (`target_user_id`),
  KEY `fk_vote_group` (`group_id`),
  CONSTRAINT `fk_vote_group` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_vote_group_id` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vote_actions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `vote_actions_ibfk_2` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vote_actions`
--

LOCK TABLES `vote_actions` WRITE;
/*!40000 ALTER TABLE `vote_actions` DISABLE KEYS */;
/*!40000 ALTER TABLE `vote_actions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vote_comments`
--

DROP TABLE IF EXISTS `vote_comments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vote_comments` (
  `id` char(36) NOT NULL,
  `vote_id` char(36) NOT NULL,
  `user_id` int NOT NULL,
  `comment` text NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `vote_comments_ibfk_1` (`vote_id`),
  CONSTRAINT `vote_comments_ibfk_1` FOREIGN KEY (`vote_id`) REFERENCES `vote_actions` (`id`) ON DELETE CASCADE,
  CONSTRAINT `vote_comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vote_comments`
--

LOCK TABLES `vote_comments` WRITE;
/*!40000 ALTER TABLE `vote_comments` DISABLE KEYS */;
/*!40000 ALTER TABLE `vote_comments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vote_records`
--

DROP TABLE IF EXISTS `vote_records`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vote_records` (
  `group_id` int NOT NULL,
  `user_id` int NOT NULL,
  `vote_action_id` char(36) NOT NULL,
  `vote_type` enum('yes','no') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `group_id` (`group_id`,`vote_action_id`,`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vote_records`
--

LOCK TABLES `vote_records` WRITE;
/*!40000 ALTER TABLE `vote_records` DISABLE KEYS */;
/*!40000 ALTER TABLE `vote_records` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-05-06 21:25:17
